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
  apiKey: { together: 'saved-together', openAi: 'saved-openai', refuseless: 'saved-refuseless' },
};

beforeEach(() => {
  mocks.fetcher.mockReset();
  mocks.fetcher.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/api/viewer') return { kind: 'user' };
    if (url === '/api/settings' || url === '/api/user/settings') {
      return options?.method === 'PUT' ? { success: true } : settings;
    }
    const body = JSON.parse(String(options?.body ?? '{}'));
    if (body.apiKey === 'entered-key') return new Promise(() => {});

    const id = url.endsWith('/refuseless') ? storyModel.model : _constant.defaultSelectedLlm.model;
    return { models: [{ id, label: id, contextLength: null }] };
  });
});
afterEach(cleanup);

const views = [
  { view: 'default settings', endpoint: '/api/settings' },
  { view: 'account sidebar', endpoint: '/api/user/settings' },
] as const;
const providers = [
  { service: 'together', label: 'Together AI' },
  { service: 'openAi', label: 'OpenAI' },
  { service: 'refuseless', label: 'Refuseless' },
] as const;

it.each(views.flatMap(view => providers.map(provider => ({ ...view, ...provider }))))(
  'submits the current $label textbox in $view while the catalog refresh is pending', async ({ endpoint, service, label }) => {
  const user = userEvent.setup();
  render(<AiModelCatalogProvider>
    {endpoint === '/api/settings' ? <SettingPage /> : <Sidebar isOpen onClose={() => {}} onOpenAiApiLogs={() => {}} />}
  </AiModelCatalogProvider>);

  const provider = await screen.findByRole('combobox', { name: 'Provider' });
  await user.selectOptions(provider, service);
  const model = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Model' });
  const selectedLlm = service === 'refuseless' ? storyModel : { service, model: _constant.defaultSelectedLlm.model };
  await waitFor(() => expect(model.value).toBe(selectedLlm.model));

  const input = screen.getByLabelText<HTMLInputElement>(label, { exact: true });
  await waitFor(() => expect(input.disabled).toBe(false));
  await user.click(input);
  // Password managers may update a field without firing a React change event.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, ' entered-key ');
  await user.click(screen.getByRole('button', { name: /save & test/i }));

  await screen.findByText('Model checks passed. Settings saved.');
  expect(mocks.fetcher).toHaveBeenCalledWith(`/api/ai/models/${service.toLowerCase()}`, expect.objectContaining({
    body: JSON.stringify({ apiKey: 'entered-key', scope: endpoint === '/api/settings' ? 'defaults' : undefined }),
  }));
  const request = mocks.fetcher.mock.calls.find(([url, options]) => url === endpoint && options?.method === 'PUT');
  const payload = JSON.parse(request?.[1].body);
  expect(payload).toMatchObject({
    selectedLlm, testModels: true,
  });
  expect(payload.apiKey).toEqual({ ...settings.apiKey, [service]: 'entered-key' });
  for (const provider of providers) {
    const field = screen.getByLabelText<HTMLInputElement>(provider.label, { exact: true });
    expect(field.placeholder).toBe(`${provider.label} API key`);
    expect(field.value).toBe(provider.service === service ? 'entered-key' : settings.apiKey[provider.service]);
  }
});

it.each(views.flatMap(view => providers.map(provider => ({ ...view, ...provider }))))(
  'prefills and clears the saved $label key in $view', async ({ endpoint, service, label }) => {
  const user = userEvent.setup();
  render(<AiModelCatalogProvider>
    {endpoint === '/api/settings' ? <SettingPage /> : <Sidebar isOpen onClose={() => {}} onOpenAiApiLogs={() => {}} />}
  </AiModelCatalogProvider>);
  const input = await screen.findByLabelText<HTMLInputElement>(label, { exact: true });
  await waitFor(() => expect(input.value).toBe(settings.apiKey[service]));
  expect(input.type).toBe('password');
  expect(screen.queryByRole('button', { name: /remove saved key/i })).toBeNull();
  await user.clear(input);
  await user.click(screen.getByRole('button', { name: /^(save|save settings)$/i }));
  await screen.findByText(endpoint === '/api/settings' ? 'Settings saved.' : 'Settings saved!');
  const request = mocks.fetcher.mock.calls.find(([url, options]) => url === endpoint && options?.method === 'PUT');
  expect(JSON.parse(request?.[1].body).apiKey).toEqual({ ...settings.apiKey, [service]: null });
  expect(input.value).toBe('');
  expect(mocks.fetcher).toHaveBeenCalledWith(`/api/ai/models/${service.toLowerCase()}`, expect.objectContaining({
    body: JSON.stringify({ apiKey: null, scope: endpoint === '/api/settings' ? 'defaults' : undefined }),
  }));
});
