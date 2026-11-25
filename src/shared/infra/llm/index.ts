import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { z } from 'zod';

import { EnvService } from '@shared/infra/env/env.service';
import { ILogger, LogLevel } from '@shared/infra/logger/types';

export interface ILlm {
  // Whether the provider is configured (key, url and the model of the kind).
  isEnabled(kind: LlmKind): boolean;
  // The structured answer, or `null` without a key, on timeout, provider error or an answer that fails the schema (never throws).
  complete<T>(request: LlmRequest<T>): Promise<null | T>;
}
export type LlmKind = 'LIGHT' | 'SEARCH';
export interface LlmRequest<T> {
  kind: LlmKind;
  schema: z.ZodType<T>;
  system: string;
  user: string;
}

interface ChatResponse {
  choices?: { message?: { content?: unknown } }[];
}

const MAX_TOKENS_LIGHT = 400;
const MAX_TOKENS_SEARCH = 800;
const MESSAGE_MAX = 300;
interface GoogleResponse {
  candidates?: { content?: { parts?: { text?: unknown }[] } }[];
}
type Provider = 'GOOGLE' | 'OPENROUTER';

const FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

function describe(error: unknown): [string, string] {
  const response = (error as { response?: { data?: unknown; status?: number } }).response;
  const body = response?.data as
    | { error?: { message?: unknown; metadata?: { raw?: unknown } } }
    | undefined;
  const message = [body?.error?.message, body?.error?.metadata?.raw]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .slice(0, MESSAGE_MAX);

  return [
    String(response?.status ?? (error as { code?: string }).code ?? 'error'),
    message || ((error as Error).message ?? 'unknown').slice(0, MESSAGE_MAX),
  ];
}
function parseJson(content: unknown): unknown {
  if (typeof content !== 'string') {
    return undefined;
  }

  const text = content.trim();
  const fenced = FENCE.exec(text);

  try {
    return JSON.parse(fenced ? fenced[1] : text);
  } catch {
    return undefined;
  }
}

// Spec 121 FR 13: OpenRouter-compatible `POST {url}/chat/completions`. SEARCH adds the web plugin.
// Only the text it is given leaves the process; the key and the prompt are never logged.
@Injectable()
export class Llm implements ILlm {
  constructor(
    private readonly env: EnvService,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  // OpenRouter first; the search falls back to Google AI Studio (its own Google Search grounding, billed to the
  // Google key) when OpenRouter is not configured or its call fails, for example without OpenRouter credit (402).
  private async askGoogle<T>(request: LlmRequest<T>): Promise<unknown> {
    const response = await axios.post<GoogleResponse>(
      `${this.env.googleAiApiUrl.replace(/\/+$/, '')}/models/${this.env.googleAiSearchModel}:generateContent`,
      {
        contents: [{ parts: [{ text: request.user }], role: 'user' }],
        generationConfig: { maxOutputTokens: MAX_TOKENS_SEARCH, temperature: 0 },
        systemInstruction: { parts: [{ text: request.system }] },
        tools: [{ google_search: {} }],
      },
      {
        headers: { 'x-goog-api-key': this.env.googleAiApiKey },
        timeout: this.env.llmTimeoutSearchMs,
      },
    );

    return response.data?.candidates?.[0]?.content?.parts
      ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
  }

  private async askOpenRouter<T>(request: LlmRequest<T>): Promise<unknown> {
    const search = request.kind === 'SEARCH';
    const response = await axios.post<ChatResponse>(
      `${this.env.llmApiUrl?.replace(/\/+$/, '')}/chat/completions`,
      {
        messages: [
          { content: request.system, role: 'system' },
          { content: request.user, role: 'user' },
        ],
        // OpenRouter reserves credit for the model's whole output limit when none is set, and answers 402.
        max_tokens: search ? MAX_TOKENS_SEARCH : MAX_TOKENS_LIGHT,
        model: this.openRouterModel(request.kind),
        ...(search ? { plugins: [{ id: 'web' }] } : {}),
        response_format: { type: 'json_object' },
        temperature: 0,
      },
      {
        headers: { Authorization: `Bearer ${this.env.llmApiKey}` },
        timeout: search ? this.env.llmTimeoutSearchMs : this.env.llmTimeoutLightMs,
      },
    );

    return response.data?.choices?.[0]?.message?.content;
  }

  async complete<T>(request: LlmRequest<T>): Promise<null | T> {
    for (const provider of this.providers(request.kind)) {
      try {
        const content =
          provider === 'GOOGLE' ? await this.askGoogle(request) : await this.askOpenRouter(request);
        const parsed = request.schema.safeParse(parseJson(content));

        if (parsed.success) {
          return parsed.data;
        }

        this.fail(request.kind, provider, 'invalid-answer', 'The answer is not the expected JSON');
      } catch (error) {
        this.fail(request.kind, provider, ...describe(error));
      }
    }

    return null;
  }

  isEnabled(kind: LlmKind): boolean {
    return this.providers(kind).length > 0;
  }

  private providers(kind: LlmKind): Provider[] {
    const openRouter = Boolean(
      this.env.llmApiKey && this.env.llmApiUrl && this.openRouterModel(kind),
    );
    const google = kind === 'SEARCH' && Boolean(this.env.googleAiApiKey);

    return [
      ...(openRouter ? (['OPENROUTER'] as const) : []),
      ...(google ? (['GOOGLE'] as const) : []),
    ];
  }

  // Never the key, the prompt or the answer: only the kind, the provider, the model, the status and the short message.
  private fail(kind: LlmKind, provider: Provider, status: string, message: string) {
    this.logger.log(LogLevel.WARN, 'LLM call failed', {
      kind,
      message,
      model: provider === 'GOOGLE' ? this.env.googleAiSearchModel : this.openRouterModel(kind),
      module: 'Llm',
      provider,
      status,
    });
  }

  private openRouterModel(kind: LlmKind): string | undefined {
    return kind === 'SEARCH' ? this.env.llmModelSearch : this.env.llmModelLight;
  }
}
