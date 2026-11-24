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

  async complete<T>(request: LlmRequest<T>): Promise<null | T> {
    if (!this.isEnabled(request.kind)) {
      return null;
    }

    const search = request.kind === 'SEARCH';

    try {
      const response = await axios.post<ChatResponse>(
        `${this.env.llmApiUrl?.replace(/\/+$/, '')}/chat/completions`,
        {
          messages: [
            { content: request.system, role: 'system' },
            { content: request.user, role: 'user' },
          ],
          // OpenRouter reserves credit for the model's whole output limit when none is set, and answers 402.
          max_tokens: search ? MAX_TOKENS_SEARCH : MAX_TOKENS_LIGHT,
          model: this.model(request.kind),
          ...(search ? { plugins: [{ id: 'web' }] } : {}),
          response_format: { type: 'json_object' },
          temperature: 0,
        },
        {
          headers: { Authorization: `Bearer ${this.env.llmApiKey}` },
          timeout: search ? this.env.llmTimeoutSearchMs : this.env.llmTimeoutLightMs,
        },
      );
      const parsed = request.schema.safeParse(
        parseJson(response.data?.choices?.[0]?.message?.content),
      );

      if (!parsed.success) {
        this.fail(request.kind, 'invalid-answer', 'The answer is not the expected JSON');
      }

      return parsed.success ? parsed.data : null;
    } catch (error) {
      this.fail(request.kind, ...describe(error));

      return null;
    }
  }

  isEnabled(kind: LlmKind): boolean {
    return Boolean(this.env.llmApiKey && this.env.llmApiUrl && this.model(kind));
  }

  // Never the key, the prompt or the answer: only the kind, the model, the status and the provider's short message.
  private fail(kind: LlmKind, status: string, message: string) {
    this.logger.log(LogLevel.WARN, 'LLM call failed', {
      kind,
      message,
      model: this.model(kind),
      module: 'Llm',
      status,
    });
  }

  private model(kind: LlmKind): string | undefined {
    return kind === 'SEARCH' ? this.env.llmModelSearch : this.env.llmModelLight;
  }
}
