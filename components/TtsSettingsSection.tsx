'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFetcher } from '@/components/FetcherProvider';
import { DEFAULT_TTS_CONFIG, TTS_PREVIEW_TEXT } from '@/lib/ttsConfig';
import { requestTtsAudio } from '@/lib/ttsAudioClient';
import { playAudioBlob, stopAudioPlayback, subscribeToAudioPlayback } from '@/lib/ttsIndexedDb';
import type { TtsConfig, TtsModelOption } from '@/types';

interface Props {
  actorKind?: 'user' | 'guest';
  scope?: 'actor' | 'defaults';
  value?: TtsConfig;
  onChange?: (value: TtsConfig) => void;
  credentialsDirty?: boolean;
}

export function TtsSettingsSection({ actorKind = 'user', scope = 'actor', value, onChange, credentialsDirty = false }: Props) {
  const { fetcher } = useFetcher();
  const [localValue, setLocalValue] = useState<TtsConfig>(DEFAULT_TTS_CONFIG);
  const config = value ?? localValue;
  const [ready, setReady] = useState(Boolean(value));
  const [models, setModels] = useState<TtsModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasPreview, setHasPreview] = useState(false);
  const [revision, setRevision] = useState(0);
  const [settingsRevision, setSettingsRevision] = useState(0);
  const preview = useRef<Blob | null>(null);
  const dirty = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const query = scope === 'defaults' ? '?scope=defaults' : '';

  const stopPreview = useCallback(() => {
    pending.current?.abort(); pending.current = null;
    stopAudioPlayback('tts-preview'); setBusy(false);
  }, []);
  const clearPreview = useCallback(() => {
    stopPreview(); preview.current = null; setHasPreview(false);
  }, [stopPreview]);

  useEffect(() => {
    if (value) return;
    const controller = new AbortController();
    setReady(false);
    fetcher<{ selectedTts: TtsConfig }>(`/api/ai/tts${query}`, { silent: true, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { if (!dirty.current) setLocalValue(data.selectedTts); setReady(true); } })
      .catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Could not load TTS settings.'); });
    return () => controller.abort();
  }, [fetcher, query, value, actorKind, settingsRevision]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setCatalogError(''); setModels([]);
    fetcher<{ models: TtsModelOption[] }>(`/api/ai/tts/models/${config.service === 'openAi' ? 'openai' : 'together'}${query}`, { silent: true, signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setModels(data.models); if (!data.models.length) setCatalogError('No speech models were returned.'); } })
      .catch(error => { if (!controller.signal.aborted) setCatalogError(error instanceof Error ? error.message : 'Could not load speech models.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [fetcher, config.service, query, revision, actorKind]);

  useEffect(() => {
    const changed = () => { clearPreview(); setRevision(previous => previous + 1); setSettingsRevision(previous => previous + 1); };
    const actorChanged = () => { dirty.current = false; changed(); };
    window.addEventListener('aistory:settings', changed);
    window.addEventListener('aistory:actor', actorChanged);
    window.addEventListener('aistory:audio-interrupt', clearPreview);
    const unsubscribe = subscribeToAudioPlayback(status => setPlaying(status.activeSegmentId === 'tts-preview' && status.state !== 'idle' && status.state !== 'error'));
    return () => { window.removeEventListener('aistory:settings', changed); window.removeEventListener('aistory:actor', actorChanged); window.removeEventListener('aistory:audio-interrupt', clearPreview); unsubscribe(); pending.current?.abort(); stopAudioPlayback('tts-preview'); };
  }, [clearPreview]);

  useEffect(() => { clearPreview(); }, [config.service, config.model, config.voice, credentialsDirty, clearPreview]);

  function change(next: TtsConfig) { dirty.current = true; setMessage(''); if (onChange) onChange(next); else setLocalValue(next); }
  const model = models.find(model => model.id === config.model);
  const valid = Boolean(model?.voices.some(voice => voice.id === config.voice));

  async function testVoice() {
    clearPreview(); window.dispatchEvent(new Event('aistory:audio-interrupt')); setMessage(''); setBusy(true);
    const controller = new AbortController(); pending.current = controller;
    try {
      const { audioBlob } = await requestTtsAudio(TTS_PREVIEW_TEXT, config, { scope, signal: controller.signal });
      if (controller.signal.aborted) return;
      preview.current = audioBlob; setHasPreview(true);
      await playAudioBlob('tts-preview', audioBlob);
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Voice test failed.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  async function save() {
    setSaving(true); setMessage('');
    try {
      await fetcher(`/api/${actorKind}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedTts: config }), silent: true });
      dirty.current = false;
      window.dispatchEvent(new Event('aistory:settings')); setMessage('Voice settings saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save voice settings.'); }
    finally { setSaving(false); }
  }

  const fieldClass = 'mt-1 w-full rounded border border-border bg-background p-2';
  return <fieldset className="space-y-3 rounded border border-border p-3">
    <legend className="px-1 font-semibold text-secondary">Text to speech</legend>
    <label className="block text-sm">Speech provider<select aria-label="Speech provider" className={fieldClass} value={config.service} disabled={!ready || saving} onChange={event => change({ service: event.target.value as TtsConfig['service'], model: '', voice: '' })}>
      <option value="together">Together AI</option><option value="openAi">OpenAI</option>
    </select></label>
    <label className="block text-sm">Speech model<select aria-label="Speech model" className={fieldClass} value={config.model} disabled={!ready || loading || saving} onChange={event => { const next = models.find(item => item.id === event.target.value); change({ ...config, model: event.target.value, voice: next?.defaultVoice ?? '' }); }}>
      <option value="">{loading ? 'Loading models...' : 'Select a model'}</option>
      {config.model && !model && <option value={config.model}>{config.model}{loading ? '' : ' (unavailable)'}</option>}
      {models.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    <label className="block text-sm">Voice<select aria-label="Voice" className={fieldClass} value={config.voice} disabled={!model || loading || saving} onChange={event => change({ ...config, voice: event.target.value })}>
      <option value="">Select a voice</option>
      {config.voice && !valid && <option value={config.voice}>{config.voice}{loading ? '' : ' (unavailable)'}</option>}
      {model?.voices.map(voice => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
    </select></label>
    {catalogError && <p role="alert" className="text-sm text-red-500">{catalogError}</p>}
    <button type="button" className="text-sm underline disabled:opacity-50" disabled={loading} onClick={() => { setRevision(previous => previous + 1); if (!ready) setSettingsRevision(previous => previous + 1); }}>Reload models</button>
    <p className="text-xs text-muted-foreground">{TTS_PREVIEW_TEXT}</p>
    <p className="text-xs text-muted-foreground">AI-generated voice. Testing uses your audio allowance or provider credits.</p>
    {credentialsDirty && <p className="text-xs text-amber-500">Save your API key changes before testing a voice.</p>}
    <div className="flex flex-wrap gap-3 text-sm">
      <button type="button" className="rounded border border-border px-3 py-2 disabled:opacity-50" disabled={!ready || !valid || loading || busy || saving || credentialsDirty} onClick={() => void testVoice()}>{busy ? 'Generating...' : 'Test voice'}</button>
      {(busy || playing) && <button type="button" onClick={stopPreview}>Stop</button>}
      {hasPreview && !busy && !playing && <button type="button" onClick={() => {
        const blob = preview.current;
        window.dispatchEvent(new Event('aistory:audio-interrupt'));
        preview.current = blob; setHasPreview(Boolean(blob));
        void playAudioBlob('tts-preview', blob ?? undefined).catch(error => setMessage(error.message));
      }}>Replay</button>}
      {!onChange && <button type="button" className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={!ready || !valid || loading || saving || busy} onClick={() => void save()}>{saving ? 'Saving...' : 'Save voice'}</button>}
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </fieldset>;
}
