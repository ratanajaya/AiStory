/** @vitest-environment jsdom */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), push: vi.fn(), alert: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/components/AlertBox', () => ({ useAlert: () => ({ showAlert: mocks.alert }) }));
vi.mock('@/components/PromptEditorSection', () => ({ PromptEditorSection: () => null }));
import TemplateForm from './TemplateForm';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.fetcher.mockImplementation(async (path: string) => {
    if (path === '/api/viewer') return { isAdmin: false };
    return { templateId: 't1', name: 'Template', storyBackground: 'Background', writingStyle: 'Style', starterOutline: 'Meet Mara.\nA storm arrives.', promptBuilder: {} };
  });
});
afterEach(cleanup);
it('loads, edits, and persists a multiline starter outline', async () => {
  render(<TemplateForm templateId="t1" />);
  const field = await screen.findByRole('textbox', { name: 'Starter Outline' });
  expect((field as HTMLTextAreaElement).value).toBe('Meet Mara.\nA storm arrives.');
  await userEvent.setup().clear(field);
  await userEvent.setup().type(field, 'A new opening.\nMara departs.');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Update Template' }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/templates'));
  const save = mocks.fetcher.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(save![1].body).starterOutline).toBe('A new opening.\nMara departs.');
});
it('includes an edited starter outline in the pre-sign-in draft save', async () => {
  render(<TemplateForm templateId="t1" />);
  const field = await screen.findByRole('textbox', { name: 'Starter Outline' });
  expect((field as HTMLTextAreaElement).value).toBe('Meet Mara.\nA storm arrives.');
  await userEvent.setup().clear(field);
  await userEvent.setup().type(field, 'Saved before sign-in.');
  const detail = { pending: [] as Promise<unknown>[], returnTo: '' };
  await act(async () => {
    window.dispatchEvent(new CustomEvent('aistory:before-signin', { cancelable: true, detail }));
    await Promise.all(detail.pending);
  });
  const save = mocks.fetcher.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(save![1].body).starterOutline).toBe('Saved before sign-in.');
});
