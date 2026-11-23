import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { z } from 'zod';

import { EnvService } from '@shared/infra/env/env.service';

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

const FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

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
  constructor(private readonly env: EnvService) {}

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

      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  isEnabled(kind: LlmKind): boolean {
    return Boolean(this.env.llmApiKey && this.env.llmApiUrl && this.model(kind));
  }

  private model(kind: LlmKind): string | undefined {
    return kind === 'SEARCH' ? this.env.llmModelSearch : this.env.llmModelLight;
  }
}
