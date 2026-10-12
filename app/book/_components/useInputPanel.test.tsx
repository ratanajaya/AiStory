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

function Harness({ currentBook = book, modeDisabled = false, disabled = false, ready = true }: {
  currentBook?: Book; modeDisabled?: boolean; disabled?: boolean; ready?: boolean;
}) {
  const panel = useInputPanel({ ready, book: currentBook, inputTag: 'OUTLINE:', modeDisabled, disabled });
  return <>{panel.element}<button onClick={() => mocks.input(panel.getUserInput())}>Read input</button>
    <button onClick={() => void panel.flushDraft()}>Save draft</button></>;
}
beforeEach(() => { vi.clearAllMocks(); mocks.fetcher.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

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
  await waitFor(() => expect(mocks.fetcher).toHaveBeenCalled());
  expect(mocks.fetcher.mock.calls.every(([url]) => url === '/api/books/b1/draft')).toBe(true);
  expect(JSON.parse(mocks.fetcher.mock.calls.at(-1)![1].body)).toEqual({ draftOutline: 'Confrontation, argument, forgiveness' });
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
  expect(mocks.fetcher).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mocks.fetcher).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Before sign-in' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save draft' })); });
  expect(mocks.fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(mocks.fetcher.mock.calls.at(-1)![1].body)).toEqual({ draftOutline: 'Before sign-in' });
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(mocks.fetcher).toHaveBeenCalledTimes(2);
});
