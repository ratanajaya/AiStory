/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Book } from '@/types';
import { createEmptyLongTermMemoryState } from '@/lib/bookMemory';
import { narrationModeIds, narrationModes } from '@/lib/narrationModes';

const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), input: vi.fn() }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('react-resizable-panels', () => ({ Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
import useInputPanel from './useInputPanel';

const book: Book = { bookId: 'b1', templateId: 't1', name: 'Book', draftOutline: 'Existing direction',
  storySegments: [], segmentSummaries: [], chapters: [], longTermMemory: createEmptyLongTermMemoryState() };
const draftCalls = () => mocks.fetcher.mock.calls.filter(([url]) => url.endsWith('/draft'));
const autocompleteCalls = () => mocks.fetcher.mock.calls.filter(([url]) => url === '/api/ai/autocomplete');

function Harness({ currentBook = book, modeDisabled = false, disabled = false, ready = true }: {
  currentBook?: Book; modeDisabled?: boolean; disabled?: boolean; ready?: boolean;
}) {
  const panel = useInputPanel({ ready, book: currentBook, inputTag: 'OUTLINE:', modeDisabled, disabled });
  return <>{panel.element}<button onClick={() => mocks.input(panel.getUserInput())}>Read input</button>
    <button onClick={() => void panel.flushDraft()}>Save draft</button></>;
}
beforeEach(() => { vi.clearAllMocks(); mocks.fetcher.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('shows four compact toggles and no idea generator or visible mode label', () => {
  render(<Harness />);
  const group = screen.getByRole('group', { name: 'Writing mode' });
  expect(within(group).getAllByRole('button')).toHaveLength(4);
  expect(screen.getByRole('button', { name: 'Full outline' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByText('Writing mode')).toBeNull();
  expect(screen.queryByPlaceholderText('Outline idea (optional)')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
});

it('switches every mode without clearing text or generating and saves direction only', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const direction = screen.getByRole('textbox', { name: 'Segment direction' });
  await user.clear(direction);
  await user.type(direction, 'Confrontation, argument, forgiveness');
  for (const mode of narrationModeIds) {
    await user.click(screen.getByRole('button', { name: narrationModes[mode].label }));
    expect(within(screen.getByRole('group')).getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect((direction as HTMLTextAreaElement).value).toBe('Confrontation, argument, forgiveness');
    expect(direction.getAttribute('placeholder')).toContain(narrationModes[mode].placeholder);
    await user.click(screen.getByRole('button', { name: 'Read input' }));
    expect(mocks.input).toHaveBeenLastCalledWith({ input1: 'Confrontation, argument, forgiveness', narrationMode: mode });
  }
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(draftCalls().length).toBeGreaterThan(0));
  expect(autocompleteCalls()).toHaveLength(0);
  for (const [url, options] of draftCalls()) {
    expect(url).toBe('/api/books/b1/draft');
    expect(JSON.parse(options.body)).toEqual({ draftOutline: 'Confrontation, argument, forgiveness' });
  }
});

it('resets to Full outline when opening another book and reopening the original', async () => {
  const user = userEvent.setup();
  const view = render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Start only' }));
  view.rerender(<Harness currentBook={{ ...book, bookId: 'b2', draftOutline: 'Other draft' }} />);
  expect(screen.getByRole('button', { name: 'Full outline' }).getAttribute('aria-pressed')).toBe('true');
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Other draft');
  view.rerender(<Harness />);
  expect(screen.getByRole('button', { name: 'Full outline' }).getAttribute('aria-pressed')).toBe('true');
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Existing direction');
});

it.each([{ modeDisabled: true }, { disabled: true }, { ready: false }])('locks mode selection for %j', props => {
  render(<Harness {...props} />);
  for (const button of within(screen.getByRole('group')).getAllByRole('button')) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
  }
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(props.disabled === true);
});

it('supports keyboard selection and tooltip guidance on hover and focus', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Full outline' }));
  expect((await screen.findByRole('tooltip')).textContent).toBe(narrationModes.outline.description);
  await user.tab();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: narrationModes.startEnd.label }).getAttribute('aria-pressed')).toBe('true');
  await user.tab();
  await user.keyboard(' ');
  expect(screen.getByRole('button', { name: 'Start only' }).getAttribute('aria-pressed')).toBe('true');
  await user.hover(screen.getByRole('button', { name: 'Events' }));
  expect(screen.getAllByRole('tooltip').some(t => t.textContent === narrationModes.events.description)).toBe(true);
});

it('debounces changes and flushes pending draft saves immediately', async () => {
  vi.useFakeTimers();
  render(<Harness />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'First draft' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(499); });
  expect(draftCalls()).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(draftCalls()).toHaveLength(1);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Before sign-in' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save draft' })); });
  expect(draftCalls()).toHaveLength(2);
  expect(JSON.parse(draftCalls()[1][1].body)).toEqual({ draftOutline: 'Before sign-in' });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(draftCalls()).toHaveLength(2);
});

async function openAutocomplete(complete: () => unknown = () => ({ suffix: ' and heads for the station.' })) {
  vi.useFakeTimers();
  mocks.fetcher.mockImplementation(async (url) => {
    if (url === '/api/viewer') return { autocomplete: { available: true, model: { service: 'openAi', model: 'test-chat' } } };
    if (url === '/api/ai/autocomplete') return complete();
    return {};
  });
  const view = render(<Harness />);
  await act(async () => {});
  const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Segment direction' });
  act(() => field.focus());
  return { ...view, field };
}

async function advance(ms = 750) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

it('debounces edits, previews the suffix, and saves the exact text only after Tab accepts', async () => {
  const { field } = await openAutocomplete();
  const draft = 'Mara packs a bag';
  await advance();
  expect(autocompleteCalls()).toHaveLength(0);
  fireEvent.change(field, { target: { value: 'Mara packs a' } });
  await advance(700);
  fireEvent.change(field, { target: { value: draft } });
  await advance(749);
  expect(autocompleteCalls()).toHaveLength(0);
  await advance(1);
  expect(JSON.parse(autocompleteCalls()[0][1].body)).toEqual({
    bookId: 'b1', draftTail: draft,
  });
  expect(screen.getByRole('status').textContent).toContain('and heads for the station.');
  expect(field.value).toBe(draft);
  expect(JSON.parse(draftCalls().at(-1)![1].body)).toEqual({ draftOutline: draft });
  expect(fireEvent.keyDown(field, { key: 'Tab' })).toBe(false);
  const accepted = draft + ' and heads for the station.';
  expect(field.value).toBe(accepted);
  expect(field.selectionStart).toBe(accepted.length);
  expect(fireEvent.keyDown(field, { key: 'Tab' })).toBe(true);
  await advance(2_000);
  expect(autocompleteCalls()).toHaveLength(1);
  expect(JSON.parse(draftCalls().at(-1)![1].body)).toEqual({ draftOutline: accepted });
});

it('waits for composition and discards a late response after the caret moves', async () => {
  let finish: (value: { suffix: string }) => void = () => {};
  const { field } = await openAutocomplete(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.compositionStart(field);
  fireEvent.change(field, { target: { value: 'Mara finds a letter' } });
  await advance();
  expect(autocompleteCalls()).toHaveLength(0);
  fireEvent.compositionEnd(field);
  await advance();
  expect(autocompleteCalls()).toHaveLength(1);
  field.setSelectionRange(1, 1);
  fireEvent.select(field);
  expect(autocompleteCalls()[0][1].signal.aborted).toBe(true);
  await act(async () => finish({ suffix: ' that she recognizes.' }));
  expect(screen.getByRole('status').textContent).toBe('');
});

it('sends only the textarea text for the owned book and supports Escape and button acceptance', async () => {
  const { field } = await openAutocomplete();
  expect(screen.queryByRole('switch', { name: 'Include story context' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Events' }));
  fireEvent.change(field, { target: { value: 'Mara finds a letter' } });
  await advance();
  expect(JSON.parse(autocompleteCalls()[0][1].body)).toEqual({ bookId: 'b1', draftTail: 'Mara finds a letter' });
  expect(fireEvent.keyDown(field, { key: 'Escape' })).toBe(false);
  expect(field.value).toBe('Mara finds a letter');
  expect(screen.queryByRole('button', { name: /Accept suggestion/ })).toBeNull();
  fireEvent.change(field, { target: { value: 'Mara packs a case' } });
  await advance();
  fireEvent.click(screen.getByRole('button', { name: /Accept suggestion/ }));
  expect(field.value).toBe('Mara packs a case and heads for the station.');
});

it('shows a wrapped suggestion outside the editor when clipped and returns it inline when it fits', async () => {
  const suffix = '\nShe hears the door close.';
  let suffixRect = new DOMRect(12, 60, 160, 20);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 240, 64));
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    const rects = this.textContent === suffix ? [suffixRect] : [];
    return Object.assign(rects, { item: (index: number) => rects[index] ?? null });
  });
  const { field, container } = await openAutocomplete(() => ({ suffix }));
  const draft = 'Mara waits in the hallway.';
  fireEvent.change(field, { target: { value: draft } });
  await advance();

  const inline = within(container).getByText(suffix.trim());
  const fallback = screen.getAllByText(suffix.trim()).find(element => element !== inline);
  expect(inline.parentElement?.style.visibility).toBe('hidden');
  expect(fallback?.style.visibility).toBe('visible');
  expect(field.value).toBe(draft);

  suffixRect = new DOMRect(12, 36, 160, 20);
  fireEvent.scroll(field);
  expect(screen.getByText(suffix.trim())).toBe(inline);
  expect(inline.parentElement?.style.visibility).toBe('');
});
