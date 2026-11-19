// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AiModelCatalogProvider } from '@/components/AiModelCatalogProvider';
import { Sidebar } from '@/app/_components/Sidebar';
import _constant from '@/utils/_constant';
import SettingPage from './page';

const mocks = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock('@/components/FetcherProvider', () => ({ useFetcher: () => ({ fetcher: mocks.fetcher }) }));
vi.mock('@/components/TtsSettingsSection', () => ({ TtsSettingsSection: () => null }));
vi.mock('@/app/_components/SignInToKeepLink', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ usePathname: () => '/setting' }));
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));

const storyModel = { service: 'refuseless', model: 'refuseless-chat' };
const settings = {
  selectedLlm: _constant.defaultSelectedLlm,
  promptBuilder: _constant.emptyPromptBuilder,
  generationProfiles: _constant.defaultGenerationProfiles,
  configured: { together: true, openAi: true, refuseless: false },
};

beforeEach(() => {
  mocks.fetcher.mockReset();
  mocks.fetcher.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/api/viewer') return { kind: 'user' };
    if (url === '/api/settings' || url === '/api/user/settings') {
      return options?.method === 'PUT' ? { success: true } : settings;
    }
    const body = JSON.parse(String(options?.body ?? '{}'));
    if (url.endsWith('/refuseless') && body.apiKey) return new Promise(() => {});

    const id = url.endsWith('/refuseless') ? storyModel.model : _constant.defaultSelectedLlm.model;
    return { models: [{ id, label: id, contextLength: null }] };
  });
});
afterEach(cleanup);

it.each([
  { view: 'default settings', endpoint: '/api/settings' },
  { view: 'account sidebar', endpoint: '/api/user/settings' },
])('submits the current Refuseless textbox in $view while the catalog refresh is pending', async ({ endpoint }) => {
  const user = userEvent.setup();
  render(<AiModelCatalogProvider>
    {endpoint === '/api/settings' ? <SettingPage /> : <Sidebar isOpen onClose={() => {}} onOpenAiApiLogs={() => {}} />}
  </AiModelCatalogProvider>);

  const provider = await screen.findByRole('combobox', { name: 'Provider' });
  await user.selectOptions(provider, 'refuseless');
  const model = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Model' });
  await waitFor(() => expect(model.value).toBe(storyModel.model));

  const input = screen.getByLabelText<HTMLInputElement>('Refuseless', { exact: true });
  await waitFor(() => expect(input.disabled).toBe(false));
  await user.click(input);
  // Password managers may update a field without firing a React change event.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, ' entered-key ');
  await user.click(screen.getByRole('button', { name: /save & test/i }));

  await screen.findByText('Model checks passed. Settings saved.');
  expect(mocks.fetcher).toHaveBeenCalledWith('/api/ai/models/refuseless', expect.objectContaining({
    body: JSON.stringify({ apiKey: 'entered-key', scope: endpoint === '/api/settings' ? 'defaults' : undefined }),
  }));
  const request = mocks.fetcher.mock.calls.find(([url, options]) => url === endpoint && options?.method === 'PUT');
  const payload = JSON.parse(request?.[1].body);
  expect(payload).toMatchObject({
    selectedLlm: storyModel, testModels: true, apiKey: { refuseless: 'entered-key' },
  });
  expect(payload.apiKey).toEqual({ refuseless: 'entered-key' });
  for (const provider of ['Together AI', 'OpenAI', 'Refuseless']) {
    expect(screen.getByLabelText<HTMLInputElement>(provider, { exact: true }).placeholder).toBe(`Replace saved ${provider} API key`);
  }
});
