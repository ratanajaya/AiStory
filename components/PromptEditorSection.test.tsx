/** @vitest-environment jsdom */
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptEditorSection } from './PromptEditorSection';
import type { PromptBuilderConfig } from '@/types';
import _constant from '@/utils/_constant';

function Harness() {
  const [config, setConfig] = useState<PromptBuilderConfig>({ ..._constant.emptyPromptBuilder,
    narrationSystem: 'Original renderer', narration2: 'Original request', narration1: 'Shared context',
    outlineIdeaGenerator: 'Legacy request', outlineIdeaGeneratorSystem: 'Legacy system' });
  return <><PromptEditorSection promptBuilder={config} onPromptBuilderChange={(field, value) => setConfig(prev => ({ ...prev, [field]: value }))} />
    <output data-testid='config'>{JSON.stringify(config)}</output></>;
}
afterEach(cleanup);

it('edits mode-specific prompts without replacing original prompts, context, or deprecated fields', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.getAllByRole('tab')).toHaveLength(4);
  await user.click(screen.getByRole('tab', { name: 'Start → End' }));
  await user.type(screen.getByLabelText('Narration system prompt:'), 'Custom bridge system');
  fireEvent.change(screen.getByLabelText('Narration request:'), { target: { value: '{textboxInput} with {writingStyle}' } });
  await user.click(screen.getByRole('tab', { name: 'Events' }));
  expect((screen.getByLabelText('Narration system prompt:') as HTMLTextAreaElement).value).toBe('');
  await user.click(screen.getByRole('tab', { name: 'Full outline' }));
  expect((screen.getByLabelText('Narration system prompt:') as HTMLTextAreaElement).value).toBe('Original renderer');
  expect(JSON.parse(screen.getByTestId('config').textContent!)).toMatchObject({
    narrationSystem: 'Original renderer', narration2: 'Original request', narration1: 'Shared context',
    narrationStartEndSystem: 'Custom bridge system', narrationStartEndRequest: '{textboxInput} with {writingStyle}',
    outlineIdeaGenerator: 'Legacy request', outlineIdeaGeneratorSystem: 'Legacy system',
  });
  expect(screen.getByText('Outline generator system prompt (deprecated):')).toBeTruthy();
  expect(screen.getByText('Outline generator request (deprecated):')).toBeTruthy();
});
