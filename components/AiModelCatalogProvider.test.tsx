// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiModelCatalogProvider, useAiModelCatalog } from './AiModelCatalogProvider';
import type { LLMService } from '@/types';

const mocks = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock('@/components/FetcherProvider', () => ({
  useFetcher: () => ({ fetcher: mocks.fetcher }),
}));

function Consumer() {
  const { getEntry, loadModels } = useAiModelCatalog();
  const [service, setService] = React.useState<LLMService>('openAi');
  const [key, setKey] = React.useState<string | null>('');
  const entry = getEntry(service, key);
  return (
    <div>
      <span>{entry.models.map((model) => model.id).join(',')}</span>
      <button onClick={() => setService(service === 'openAi' ? 'together' : 'openAi')}>Switch</button>
      <button onClick={() => setService('refuseless')}>Refuseless</button>
      <button onClick={() => { setKey('new-key'); void loadModels('openAi', 'new-key'); }}>Change key</button>
      <button onClick={() => { setKey(null); void loadModels('openAi', null); }}>Clear key</button>
      <button onClick={() => { setKey(''); void loadModels('openAi'); }}>Use saved key</button>
    </div>
  );
}

describe('AiModelCatalogProvider', () => {
  it('preloads each provider once and does not refetch on provider switches', async () => {
    mocks.fetcher.mockReset();
    mocks.fetcher.mockImplementation(async (url: string) => ({
      models: [{ id: url.endsWith('/openai') ? 'gpt-6-luna' : url.endsWith('/refuseless') ? 'refuseless-chat' : 'chat-a', label: 'model', contextLength: null }],
    }));

    render(<AiModelCatalogProvider><Consumer /></AiModelCatalogProvider>);
    await waitFor(() => expect(screen.getByText('gpt-6-luna')).toBeTruthy());
    expect(mocks.fetcher).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByText('Refuseless'));
    expect(screen.getByText('refuseless-chat')).toBeTruthy();
    fireEvent.click(screen.getByText('Switch'));
    fireEvent.click(screen.getByText('Switch'));
    expect(screen.getByText('chat-a')).toBeTruthy();
    fireEvent.click(screen.getByText('Switch'));
    expect(screen.getByText('gpt-6-luna')).toBeTruthy();
    expect(mocks.fetcher).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByText('Change key'));
    await waitFor(() => expect(mocks.fetcher).toHaveBeenCalledTimes(4));
    expect(mocks.fetcher).toHaveBeenLastCalledWith('/api/ai/models/openai', expect.objectContaining({
      body: JSON.stringify({ apiKey: 'new-key' }),
    }));

    fireEvent.click(screen.getByText('Clear key'));
    await waitFor(() => expect(mocks.fetcher).toHaveBeenCalledTimes(5));
    expect(mocks.fetcher).toHaveBeenLastCalledWith('/api/ai/models/openai', expect.objectContaining({
      body: JSON.stringify({ apiKey: null }),
    }));
    fireEvent.click(screen.getByText('Use saved key'));
    await waitFor(() => expect(screen.getByText('gpt-6-luna')).toBeTruthy());
    expect(mocks.fetcher).toHaveBeenCalledTimes(5);
  });
});
