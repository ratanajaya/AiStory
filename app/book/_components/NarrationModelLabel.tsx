import type { LlmConfig } from '@/types';

export default function NarrationModelLabel({
  model,
  prominent = false,
}: {
  model: LlmConfig | null | undefined;
  prominent?: boolean;
}) {
  if (!model) return null;

  const provider = model.service === 'openAi' ? 'OpenAI' : 'Together AI';
  return (
    <span
      className={prominent
        ? 'inline-flex max-w-full items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-sm font-medium text-foreground'
        : 'inline-block max-w-full truncate text-xs text-muted-foreground'}
      title={`Narration model: ${provider} · ${model.model}`}
    >
      Narration model: {provider} · {model.model}
    </span>
  );
}
