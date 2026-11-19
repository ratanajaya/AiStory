import { APICallError } from 'ai';
import { createConfiguredAiEndpoint } from '@/lib/aiEndpointDynamic';
import { getDefaultModelPayload } from '@/lib/modelPayload';
import type { ApiKeyConfig, LlmConfig, ModelPayloadShape, ModelPayloads } from '@/types';
import _util from '@/utils/_util';

const probeProfile = { temperature: 0.7, maxOutputTokens: 256, timeoutMs: 15_000, maxRetries: 0 };

function objectField(value: unknown, field: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[field] : undefined;
}

function providerErrorDetails(error: APICallError) {
  let data: unknown = error.data;
  if (!data && error.responseBody) {
    try { data = JSON.parse(error.responseBody); } catch { /* Fall back to the SDK message. */ }
  }
  const details = objectField(data, 'error') ?? data;
  const param = objectField(details, 'param');
  const code = objectField(details, 'code');
  const message = objectField(details, 'message');
  return {
    param: typeof param === 'string' ? param.toLowerCase() : '',
    code: typeof code === 'string' ? code.toLowerCase() : '',
    message: (typeof message === 'string' ? message : error.message).toLowerCase(),
  };
}

function nextModelPayload(model: LlmConfig, shape: ModelPayloadShape, error: unknown): ModelPayloadShape | undefined {
  if (!APICallError.isInstance(error) || (error.statusCode !== 400 && error.statusCode !== 422)) return;
  const { param, code, message } = providerErrorDetails(error);
  const mentions = (field: RegExp) => field.test(param || message);
  const rejected = /^(?:unsupported_parameter|unsupported_value|unknown_parameter|invalid_value)$/.test(code)
    || /\b(?:unsupported|not supported|does not support|not allowed|not accepted|unrecognized|unknown parameter|only the default)\b/.test(message);

  if (rejected && shape.allowTemperature && mentions(/\btemperature\b/)) {
    return { ...shape, allowTemperature: false };
  }
  if (rejected && shape.reasoning === 'openai-none' && mentions(/\breasoning(?:[._]effort)?\b/)) {
    return { allowTemperature: false };
  }

  const required = code === 'missing_required_parameter' || /\b(?:missing|required|must be (?:set|provided|specified))\b/.test(message);
  if (!required || shape.reasoning) return;
  if (model.service === 'openAi' && /^gpt-6-luna(?:-\d{4}-\d{2}-\d{2})?$/.test(model.model)
    && mentions(/\breasoning(?:[._]effort)?\b/)) {
    return { allowTemperature: false, reasoning: 'openai-medium' };
  }
  if (model.service === 'together' && model.model === 'moonshotai/Kimi-K3' && mentions(/\breasoning_effort\b/)) {
    return { ...shape, reasoning: 'together-max' };
  }
  if (model.service === 'together' && (/^Qwen\/Qwen3\.5-/.test(model.model) || model.model === 'moonshotai/Kimi-K3')
    && mentions(/\breasoning(?:\.enabled)?\b/)) {
    return { ...shape, reasoning: 'together-enabled' };
  }
}

async function probeModel(model: LlmConfig, key: string, signal: AbortSignal) {
  let shape = getDefaultModelPayload(model);
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    try {
      const endpoint = createConfiguredAiEndpoint(model, key, false, shape);
      await endpoint.chatCompletionFull('This is a model check.', [{ role: 'user', content: 'Reply with OK.' }], probeProfile, { abortSignal: signal });
      signal.throwIfAborted();
      return shape;
    } catch (error) {
      const next = nextModelPayload(model, shape, error);
      if (!next || attempt === 2) throw error;
      shape = next;
    }
  }
  throw new Error('Model check exhausted its request shapes.');
}

type CheckResult = { ok: true; payloads: ModelPayloads } | { ok: false; status: number; message: string };

export async function checkModelPayloads(
  story: LlmConfig,
  autocomplete: LlmConfig | null | undefined,
  keys: ApiKeyConfig,
  signal: AbortSignal,
): Promise<CheckResult> {
  const targets = [{ slot: 'story', label: 'Story', model: story }] as const;
  const checks = autocomplete
    ? [...targets, { slot: 'autocomplete', label: 'Autocomplete', model: autocomplete } as const]
    : targets;
  const requests = checks.map(check => ({ ...check, key: _util.toIdentifierString(keys[check.model.service]) }));
  const missing = requests.find(check => !check.key);
  if (missing) {
    const providerKey = missing.model.service === 'openAi' ? 'an OpenAI API key' : 'a Together AI API key';
    return { ok: false, status: 400, message: `Set ${providerKey} to test the ${missing.label.toLowerCase()} model.` };
  }

  const deadline = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
  const payloads: ModelPayloads = {};
  for (const { slot, label, model, key } of requests) {
    if (payloads.story?.service === model.service && payloads.story.model === model.model) {
      payloads[slot] = payloads.story;
      continue;
    }
    try {
      payloads[slot] = { ...model, shape: await probeModel(model, key, deadline) };
    } catch (error) {
      const status = APICallError.isInstance(error) ? error.statusCode : undefined;
      const detail = deadline.aborted || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
        ? 'The request timed out or was canceled.'
        : status === 401 || status === 403 || status === 404
          ? 'Check the API key and access to this model.'
          : status === 402 || status === 429
            ? 'Check provider billing and usage limits.'
            : 'The provider did not return text with a supported request shape.';
      return { ok: false, status: 502, message: `${label} model check failed. ${detail}` };
    }
  }
  return { ok: true, payloads };
}
