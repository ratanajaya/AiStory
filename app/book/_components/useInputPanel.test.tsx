/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Book, Template } from '@/types';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';
import _constant from '@/utils/_constant';

const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), stream: vi.fn(), input: vi.fn() }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/components/AlertBox', () => ({ useAlert: () => ({ showAlert: vi.fn() }) }));
vi.mock('@/lib/aiStreamClient', () => ({ streamAiRequest: mocks.stream, AiStreamError: class extends Error {} }));
vi.mock('react-resizable-panels', () => ({ Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import useInputPanel from './useInputPanel';

const book: Book = { bookId: 'b1', templateId: 't1', name: 'Book', draftOutline: 'Existing direction', draftIdea: 'Legacy idea',
  storySegments: [], segmentSummaries: [], chapters: [], longTermMemory: createEmptyLongTermMemoryState() };
const template: Template = { templateId: 't1', name: 'Template', storyBackground: 'Background', writingStyle: 'Style', imageUrl: null,
  promptBuilder: { ..._constant.emptyPromptBuilder, outlineIdeaGenerator: '{textboxInput}', outlineIdeaGeneratorSystem: 'Legacy' } };

function Harness({ currentBook = book, modeDisabled = false }: { currentBook?: Book; modeDisabled?: boolean }) {
  const panel = useInputPanel({ ready: true, book: currentBook, template, inputTag: 'OUTLINE:', modeDisabled, onStatusChange: vi.fn() });
  return <>{panel.element}<button onClick={() => mocks.input(panel.getUserInput())}>Read input</button>
    <button onClick={() => void panel.flushDraft()}>Save draft</button></>;
}
beforeEach(() => { vi.clearAllMocks(); mocks.fetcher.mockResolvedValue({}); });
afterEach(cleanup);

it('switches modes without clearing text or legacy drafts and never generates automatically', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const selector = screen.getByRole('combobox', { name: 'Writing mode' });
  expect((selector as HTMLSelectElement).value).toBe('outline');
  const direction = screen.getByRole('textbox', { name: 'Segment direction' });
  await user.clear(direction);
  await user.type(direction, 'Confrontation, argument, forgiveness');
  await user.selectOptions(selector, 'events');
  expect((direction as HTMLTextAreaElement).value).toBe('Confrontation, argument, forgiveness');
  expect(direction.getAttribute('placeholder')).toContain('EVENTS:');
  expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Read input' }));
  expect(mocks.input).toHaveBeenLastCalledWith({ input1: 'Confrontation, argument, forgiveness', narrationMode: 'events' });
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mocks.fetcher).toHaveBeenCalled());
  expect(JSON.parse(mocks.fetcher.mock.calls.at(-1)![1].body)).toEqual({ draftOutline: 'Confrontation, argument, forgiveness', draftIdea: 'Legacy idea' });
  expect(mocks.stream).not.toHaveBeenCalled();
});

it('resets to Full outline when opening another book and when reopening the original book', async () => {
  const user = userEvent.setup();
  const view = render(<Harness />);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Writing mode' }), 'startOnly');
  view.rerender(<Harness currentBook={{ ...book, bookId: 'b2', draftOutline: 'Other draft' }} />);
  expect((screen.getByRole('combobox', { name: 'Writing mode' }) as HTMLSelectElement).value).toBe('outline');
  expect((screen.getByRole('textbox', { name: 'Segment direction' }) as HTMLTextAreaElement).value).toBe('Other draft');
  view.rerender(<Harness />);
  expect((screen.getByRole('combobox', { name: 'Writing mode' }) as HTMLSelectElement).value).toBe('outline');
});

it('locks mode selection during a candidate without disabling independent draft editing', () => {
  render(<Harness modeDisabled />);
  expect((screen.getByRole('combobox', { name: 'Writing mode' }) as HTMLSelectElement).disabled).toBe(true);
  expect((screen.getByRole('textbox', { name: 'Segment direction' }) as HTMLTextAreaElement).disabled).toBe(false);
});

it('retains the legacy generator behavior independently of the selected writing mode', async () => {
  mocks.stream.mockResolvedValue('Generated outline');
  const user = userEvent.setup();
  render(<Harness />);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Writing mode' }), 'events');
  await user.click(screen.getByRole('button', { name: 'Generate' }));
  await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(1));
  expect(mocks.stream.mock.calls[0][0]).toMatchObject({ feature: 'outlineIdeaGenerator', systemMessage: 'Legacy' });
  expect((screen.getByRole('combobox', { name: 'Writing mode' }) as HTMLSelectElement).value).toBe('events');
});
