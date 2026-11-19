import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createConfiguredAiEndpoint } from '@/lib/aiEndpointDynamic';
import { getDefaultModelPayload, resolveModelPayload } from '@/lib/modelPayload';
import { checkModelPayloads } from '@/lib/modelPayloadProbe';
import type { LlmConfig } from '@/types';

vi.mock('@/lib/actorSettings', () => ({ getActorGenerationSettings: vi.fn() }));

const fetcher = vi.fn<typeof fetch>();
const profile = { temperature: 0.35, maxOutputTokens: 128, timeoutMs: 5_000, maxRetries: 0 };
const keys = { openAi: 'personal-openai', together: 'personal-together' };
const signal = new AbortController().signal;
const openAi = (model: string): LlmConfig => ({ service: 'openAi', model });
const together = (model: string): LlmConfig => ({ service: 'together', model });
const luna = openAi('gpt-6-luna');
const qwen = together('Qwen/Qwen3.5-9B');
const kimi = together('moonshotai/Kimi-K3');

const openAiText = () => Response.json({
  id: 'resp_1', created_at: 1_700_000_000, model: 'test-openai',
  output: [{ type: 'message', role: 'assistant', id: 'msg_1', content: [{ type: 'output_text', text: 'OK', annotations: [] }] }],
  usage: { input_tokens: 8, output_tokens: 1 },
});
const togetherText = (content = 'OK') => Response.json({
  choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 8, completion_tokens: 1 },
});
const providerError = (status: number, message: string, code: string, param: string | null) =>
  Response.json({ error: { message, type: 'invalid_request_error', code, param } }, { status });
const requestBody = (call: number) => JSON.parse(fetcher.mock.calls[call][1]?.body as string);

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());

it.each([
  ['gpt-4.1', { temperature: 0.35 }],
  ['gpt-5.2', { temperature: 0.35, reasoning: { effort: 'none' } }],
  ['gpt-6-luna', {}],
])('sends the documented OpenAI Responses shape for %s', async (model, expected) => {
  fetcher.mockResolvedValueOnce(openAiText());
  const endpoint = createConfiguredAiEndpoint(openAi(model), keys.openAi);
  await expect(endpoint.chatCompletion(null, 'Test', profile)).resolves.toBe('OK');
  expect(fetcher.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');
  const body = requestBody(0);
  expect(body).toMatchObject({ ...expected, max_output_tokens: profile.maxOutputTokens });
  if (!('temperature' in expected)) expect(body).not.toHaveProperty('temperature');
  if (!('reasoning' in expected)) expect(body).not.toHaveProperty('reasoning');
});

it('sends explicit Luna reasoning through the pinned adapter when the provider requires it', async () => {
  fetcher.mockResolvedValueOnce(providerError(400, 'Missing required parameter: reasoning.effort.', 'missing_required_parameter', 'reasoning.effort'))
    .mockResolvedValueOnce(openAiText());
  const result = await checkModelPayloads(luna, luna, keys, signal);
  expect(result).toEqual({ ok: true, payloads: {
    story: { ...luna, shape: { allowTemperature: false, reasoning: 'openai-medium' } },
    autocomplete: { ...luna, shape: { allowTemperature: false, reasoning: 'openai-medium' } },
  } });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(requestBody(0)).not.toHaveProperty('reasoning');
  expect(requestBody(1)).toMatchObject({ reasoning: { effort: 'medium' } });
  expect(requestBody(1)).not.toHaveProperty('temperature');
});

it.each([
  { model: qwen, param: 'reasoning.enabled', expected: { reasoning: { enabled: true } } },
  { model: kimi, param: 'reasoning_effort', expected: { reasoning_effort: 'max' } },
])('uses the Together reasoning form for $model.model', async ({ model, param, expected }) => {
  fetcher.mockResolvedValueOnce(providerError(422, `Missing required parameter: ${param}`, 'missing_required_parameter', param))
    .mockResolvedValueOnce(togetherText());
  await expect(checkModelPayloads(model, null, keys, signal)).resolves.toMatchObject({ ok: true });
  expect(requestBody(0)).toMatchObject({ temperature: 0.7 });
  expect(requestBody(1)).toMatchObject({ ...expected, temperature: 0.7, max_tokens: 256 });
});

it('reuses the verified Together shape for streaming and JSON schema output', async () => {
  fetcher.mockResolvedValueOnce(providerError(400, 'Temperature is not supported for this model.', 'unsupported_parameter', 'temperature'))
    .mockResolvedValueOnce(providerError(400, 'Reasoning is required.', 'missing_required_parameter', 'reasoning'))
    .mockResolvedValueOnce(togetherText());
  const checked = await checkModelPayloads(qwen, null, keys, signal);
  expect(checked).toMatchObject({ ok: true, payloads: { story: { shape: { allowTemperature: false, reasoning: 'together-enabled' } } } });
  if (!checked.ok) throw new Error(checked.message);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const endpoint = createConfiguredAiEndpoint(qwen, keys.together, false, resolveModelPayload(qwen, checked.payloads.story, undefined));

  const chunk = JSON.stringify({ choices: [{ delta: { content: 'OK' }, finish_reason: 'stop' }] });
  fetcher.mockResolvedValueOnce(new Response(`data: ${chunk}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } }));
  fetcher.mockResolvedValueOnce(togetherText('{"operations":[]}'));
  const onChunk = vi.fn();
  await endpoint.chatStream(null, 'Generate', profile, onChunk);
  expect(onChunk).toHaveBeenCalledWith('OK');
  await expect(endpoint.chatObjectFull(null, [{ role: 'user', content: 'Generate' }], profile, {
    type: 'object', properties: { operations: { type: 'array', items: {} } }, required: ['operations'],
  })).resolves.toEqual({ operations: [] });
  expect(requestBody(3)).toMatchObject({ reasoning: { enabled: true }, stream: true, max_tokens: 128 });
  expect(requestBody(4)).toMatchObject({ reasoning: { enabled: true }, response_format: { type: 'json_schema' }, max_tokens: 128 });
  expect(requestBody(3)).not.toHaveProperty('temperature');
  expect(requestBody(4)).not.toHaveProperty('temperature');
});

it('checks every key before making a provider request', async () => {
  await expect(checkModelPayloads(luna, qwen, { ...keys, together: null }, signal)).resolves.toMatchObject({ ok: false, status: 400, message: expect.stringContaining('autocomplete') });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([401, 429, 500])('stops on provider status %s and sanitizes the error', async status => {
  fetcher.mockResolvedValueOnce(openAiText())
    .mockResolvedValueOnce(providerError(status, 'secret upstream error: temperature is unsupported', 'unsupported_parameter', 'temperature'));
  const result = await checkModelPayloads(luna, kimi, keys, signal);
  expect(result).toMatchObject({ ok: false, message: expect.stringContaining('Autocomplete model check failed') });
  expect(JSON.stringify(result)).not.toContain('secret upstream');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('uses exact model matches and prefers the actor result', () => {
  const systemRecord = { ...luna, shape: { allowTemperature: false, reasoning: 'openai-medium' as const } };
  const actorRecord = { ...luna, shape: { allowTemperature: false } };
  expect(resolveModelPayload(luna, actorRecord, systemRecord)).toBe(actorRecord.shape);
  expect(resolveModelPayload(luna, { ...actorRecord, model: 'other' }, systemRecord)).toBe(systemRecord.shape);
  expect(resolveModelPayload(qwen, actorRecord, systemRecord)).toEqual(getDefaultModelPayload(qwen));
});
