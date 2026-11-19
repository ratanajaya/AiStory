import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { generateText, streamText, ModelMessage, LanguageModel, Output, jsonSchema } from 'ai';
import { getActorGenerationSettings } from '@/lib/actorSettings';
import { assertSupportedLlmConfig } from "@/lib/llmSettings";
import type { GenerationProfile, GenerationProfileConfig, LlmConfig, ModelPayloadShape } from '@/types';
import { getDefaultModelPayload, toModelGenerationOptions } from '@/lib/modelPayload';
import { REFUSELESS_BASE_URL } from '@/lib/refuseless';
import _util from '@/utils/_util';

export interface AiEndpoint {
  chatCompletion: (systemMsg: string | null, userMsg: string, profile: GenerationProfile) => Promise<string>;
  chatCompletionFull: (systemMsg: string | null, messages: unknown[], profile: GenerationProfile, options?: {
    abortSignal?: AbortSignal;
    allowEmpty?: boolean;
  }) => Promise<string>;
  chatStream: (systemMsg: string | null, userMsg: string, profile: GenerationProfile, onReceiveChunk: (content: string) => void) => Promise<void>;
  chatStreamFull: (systemMsg: string | null, messages: unknown[], profile: GenerationProfile, onReceiveChunk: (content: string) => void) => Promise<void>;
  chatObjectFull: <T>(systemMsg: string | null, messages: unknown[], profile: GenerationProfile, schema: Record<string, unknown>) => Promise<T>;
}

interface StructuredOutputResultDiagnostics {
  finishReason?: string;
  rawFinishReason?: string;
  usage?: unknown;
  warnings?: unknown;
  text?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined;

const truncateDiagnosticText = (value: unknown, maximum = 12_000) => {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length <= maximum ? value : `${value.slice(0, maximum)}\n... [truncated ${value.length - maximum} characters]`;
};

export class AiStructuredOutputError extends Error {
  readonly cause: unknown;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>, cause: unknown) {
    super(message);
    this.name = 'AiStructuredOutputError';
    this.cause = cause;
    this.details = details;
  }
}

function createStructuredOutputError(
  model: LanguageModel,
  cause: unknown,
  result?: StructuredOutputResultDiagnostics,
  extraDetails: Record<string, unknown> = {},
) {
  const modelRecord = asRecord(model);
  const provider = typeof modelRecord?.provider === 'string' ? modelRecord.provider : 'unknown-provider';
  const modelId = typeof modelRecord?.modelId === 'string' ? modelRecord.modelId : String(model);
  const causeRecord = asRecord(cause);
  const causeName = cause instanceof Error ? cause.name : typeof causeRecord?.name === 'string' ? causeRecord.name : undefined;
  const causeMessage = cause instanceof Error
    ? cause.message
    : typeof causeRecord?.message === 'string' ? causeRecord.message : String(cause);
  const finishReason = result?.finishReason
    ?? (typeof causeRecord?.finishReason === 'string' ? causeRecord.finishReason : undefined);
  const rawFinishReason = result?.rawFinishReason
    ?? (typeof causeRecord?.rawFinishReason === 'string' ? causeRecord.rawFinishReason : undefined);
  const generatedText = truncateDiagnosticText(result?.text ?? causeRecord?.text);
  const providerAndModel = `${provider} / ${modelId}`;
  const finishDetail = finishReason ? ` finishReason=${JSON.stringify(finishReason)}.` : '';
  const remediation = finishReason === 'length'
    ? ' The model exhausted maxOutputTokens before completing the JSON object; increase the long-term-memory output limit or reduce the source batch.'
    : '';
  const causeDetail = `${causeName ? `${causeName}: ` : ''}${causeMessage}`;
  const punctuatedCauseDetail = /[.!?]$/u.test(causeDetail) ? causeDetail : `${causeDetail}.`;

  return new AiStructuredOutputError(
    `Structured output generation failed (${providerAndModel}).${finishDetail} ${punctuatedCauseDetail}${remediation}`,
    {
      provider,
      modelId,
      finishReason: finishReason ?? null,
      rawFinishReason: rawFinishReason ?? null,
      usage: result?.usage ?? causeRecord?.usage ?? null,
      warnings: result?.warnings ?? causeRecord?.warnings ?? null,
      generatedText: generatedText ?? null,
      ...extraDetails,
    },
    cause,
  );
}

const createAiSdkEndpoint = (model: LanguageModel, structuredOutputModel: LanguageModel, trialFunded: boolean, payload: ModelPayloadShape): AiEndpoint => {
  const generationOptionsFor = (profile: GenerationProfile) => ({
    ...toModelGenerationOptions(profile, payload),
    ...(trialFunded ? { maxRetries: 0 } : {}),
  });

  const chatObjectFull: AiEndpoint['chatObjectFull'] = async <T>(systemMsg: string | null, messages: unknown[], profile: GenerationProfile, schema: Record<string, unknown>) => {
    const systemPrompt: ModelMessage[] = systemMsg ? [{ role: 'system', content: systemMsg }] : [];
    const generationOptions = generationOptionsFor(profile);
    const outputBudgets = trialFunded ? [profile.maxOutputTokens] : profile.maxOutputTokens < 4_096
      ? [profile.maxOutputTokens, 4_096]
      : [profile.maxOutputTokens];
    const attempts: Array<Record<string, unknown>> = [];

    for (const [attemptIndex, maxOutputTokens] of outputBudgets.entries()) {
      let result;
      try {
        result = await generateText({
          model: structuredOutputModel,
          messages: [
            ...systemPrompt,
            ...messages,
          ] as ModelMessage[],
          output: Output.object({
            schema: jsonSchema<T>(schema as Parameters<typeof jsonSchema>[0]),
            name: 'long_term_memory_patch',
            description: 'Sparse JSON Patch operations for the book long-term memory.',
          }),
          ...generationOptions,
          maxOutputTokens,
        });
      } catch (error) {
        const errorRecord = asRecord(error);
        const finishReason = typeof errorRecord?.finishReason === 'string' ? errorRecord.finishReason : undefined;
        attempts.push({ attempt: attemptIndex + 1, maxOutputTokens, finishReason: finishReason ?? null });
        if (finishReason === 'length' && attemptIndex < outputBudgets.length - 1) continue;
        throw createStructuredOutputError(structuredOutputModel, error, undefined, { attempts });
      }

      try {
        return result.output;
      } catch (error) {
        attempts.push({
          attempt: attemptIndex + 1,
          maxOutputTokens,
          finishReason: result.finishReason,
          rawFinishReason: result.rawFinishReason ?? null,
          usage: result.usage,
        });
        if (result.finishReason === 'length' && attemptIndex < outputBudgets.length - 1) continue;
        throw createStructuredOutputError(structuredOutputModel, error, {
          finishReason: result.finishReason,
          rawFinishReason: result.rawFinishReason,
          usage: result.usage,
          warnings: result.warnings,
          text: result.text,
        }, { attempts });
      }
    }

    throw createStructuredOutputError(
      structuredOutputModel,
      new Error('Structured output retry loop completed without returning an output.'),
      undefined,
      { attempts },
    );
  };

  const chatCompletionFull: AiEndpoint['chatCompletionFull'] = async (systemMsg, messages, profile, options) => {
    const systemPrompt: ModelMessage[] = systemMsg ? [{ role: 'system', content: systemMsg }] : [];

    const { text } = await generateText({
      model,
      messages: [
        ...systemPrompt,
        ...messages,
      ] as ModelMessage[],
      ...generationOptionsFor(profile),
      ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {}),
    });

    if (!options?.allowEmpty && !text?.trim()) {
      throw new Error('LLM returned no content (empty response)');
    }

    return text ?? '';
  };

  const chatStreamFull: AiEndpoint['chatStreamFull'] = async (systemMsg, messages, profile, onReceiveChunk) => {
    const systemPrompt: ModelMessage[] = systemMsg ? [{ role: 'system', content: systemMsg }] : [];

    let streamError: unknown = null;
    const result = streamText({
      model,
      messages: [
        ...systemPrompt,
        ...messages,
      ] as ModelMessage[],
      ...generationOptionsFor(profile),
      onError: ({ error }) => {
        streamError = error;
      },
    });

    let chunksReceived = 0;
    for await (const textPart of result.textStream) {
      chunksReceived++;
      onReceiveChunk(textPart);
    }

    if (streamError) {
      throw streamError;
    }

    if (chunksReceived === 0) {
      throw new Error('LLM returned no content (empty stream)');
    }
  };

  return {
    chatObjectFull,
    chatCompletionFull,
    chatStreamFull,
    chatCompletion: (systemMsg, userMsg, profile) =>
      chatCompletionFull(systemMsg, [{ role: 'user', content: userMsg }], profile),
    chatStream: (systemMsg, userMsg, profile, onReceiveChunk) =>
      chatStreamFull(systemMsg, [{ role: 'user', content: userMsg }], profile, onReceiveChunk),
  };
};

export function createConfiguredAiEndpoint(
  selectedLlm: LlmConfig,
  apiKey: string,
  trialFunded = false,
  payload = getDefaultModelPayload(selectedLlm),
): AiEndpoint {
  assertSupportedLlmConfig(selectedLlm);
  const key = _util.toIdentifierString(apiKey);
  if (selectedLlm.service === 'together') {
    if (!key) throw new Error('Together API key is not configured');
    const together = createTogetherAI({ apiKey: key });
    // The installed Together provider is based on the generic OpenAI-compatible
    // adapter but does not advertise Together's JSON Schema capability. Use a
    // dedicated model instance for structured calls so the adapter sends
    // response_format.type=json_schema instead of silently degrading to JSON mode.
    const togetherStructured = createOpenAICompatible({
      name: 'togetherai',
      baseURL: 'https://api.together.xyz/v1',
      apiKey: key,
      supportsStructuredOutputs: true,
    });
    return createAiSdkEndpoint(together(selectedLlm.model), togetherStructured(selectedLlm.model), trialFunded, payload);
  }

  if (selectedLlm.service === 'refuseless') {
    if (!key) throw new Error('Refuseless API key is not configured');
    const refuseless = createOpenAICompatible({
      name: 'refuseless',
      baseURL: REFUSELESS_BASE_URL,
      apiKey: key,
      supportsStructuredOutputs: true,
    });
    const model = refuseless(selectedLlm.model);
    return createAiSdkEndpoint(model, model, trialFunded, payload);
  }

  if (!key) throw new Error('OpenAI API key is not configured');
  const openai = createOpenAI({ apiKey: key });
  const model = openai(selectedLlm.model);
  return createAiSdkEndpoint(model, model, trialFunded, payload);
}

// Get the endpoint based on current user configuration
export const getDynamicAiEndpoint = async (): Promise<{
  endpoint: AiEndpoint;
  generationProfiles: GenerationProfileConfig;
  selectedLlm: LlmConfig;
  trialFunded: boolean;
}> => {
  const { selectedLlm, apiKey, generationProfiles, personal, trialAccount, storyPayload } = await getActorGenerationSettings();
  // Keep accounting tied to these credentials even if settings change mid-request.
  const trialFunded = trialAccount && !personal[selectedLlm.service];
  const endpoint = createConfiguredAiEndpoint(selectedLlm, apiKey[selectedLlm.service] ?? '', trialFunded, storyPayload);
  return { endpoint, generationProfiles, selectedLlm, trialFunded };
};
