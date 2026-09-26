'use client';

import { useCallback, useEffect, useState } from 'react';
import SignInToKeepLink from '@/app/_components/SignInToKeepLink';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useFetcher } from '@/components/FetcherProvider';

type Viewer = { kind: 'visitor' | 'guest' | 'user'; isAdmin: boolean; expiresAt?: string; remaining?: { text: number; audio: number } | null; personal?: { together: boolean; openAi: boolean }; selectedLlm?: { service: 'together' | 'openAi'; model: string }; textFunding?: string; audioFunding?: string };
type ModelOption = { id: string; label: string };

export function GuestAccess() {
  const pathname = usePathname();
  const { status } = useSession();
  const { fetcher } = useFetcher();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { setDismissed(sessionStorage.getItem('aistory-reminder-dismissed') === '1'); }, []);
  const [keys, setKeys] = useState({ together: '', openAi: '' });
  const [provider, setProvider] = useState<'together' | 'openAi'>('together');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ModelOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    try { setViewer(await fetcher<Viewer>('/api/viewer', { silent: true })); } catch { setViewer(null); }
  }, [fetcher]);
  useEffect(() => { void refresh(); const onFocus = () => void refresh(); const onOpen = () => setOpen(true); window.addEventListener('focus', onFocus); window.addEventListener('aistory:keys', onOpen); window.addEventListener('aistory:usage', onFocus); window.addEventListener('aistory:settings', onFocus); return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('aistory:keys', onOpen); window.removeEventListener('aistory:usage', onFocus); window.removeEventListener('aistory:settings', onFocus); }; }, [refresh, pathname, status]);
  useEffect(() => { if (viewer?.selectedLlm) { setProvider(viewer.selectedLlm.service); setModel(viewer.selectedLlm.model); } }, [viewer?.selectedLlm]);
  async function loadModels() {
    try { const result = await fetcher<{ models: ModelOption[] }>(`/api/ai/models/${provider === 'openAi' ? 'openai' : 'together'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' , silent: true }); setModels(result.models); } catch { setModels([]); }
  }
  async function save(test = false) {
    if (test && !keys[provider].trim() && !viewer?.personal?.[provider]) { setMessage('Add a personal key for the selected text provider before testing.'); return; }
    if (test && !model) { setMessage('Select a model before testing.'); return; }
    setBusy(true); setMessage('');
    try {
      if (viewer?.kind === 'visitor') await fetcher('/api/guest/session', { method: 'POST' });
      const keyUpdate = Object.fromEntries(Object.entries(keys).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
      const url = viewer?.kind === 'user' ? '/api/user/settings' : '/api/guest/settings';
      await fetcher(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: keyUpdate, ...(model ? { selectedLlm: { service: provider, model } } : {}) }) });
      setKeys({ together: '', openAi: '' });
      await refresh(); window.dispatchEvent(new Event('aistory:settings'));
      if (keyUpdate[provider] || viewer?.personal?.[provider]) await loadModels();
      if (test) {
        await fetcher('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ feature: 'default', stream: false, messages: [{ role: 'user', content: 'Reply OK.' }] }) });
      }
      setMessage(test ? 'Key saved and test passed.' : 'Settings saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save settings.'); } finally { setBusy(false); }
  }
  async function remove(service: 'together' | 'openAi') {
    setBusy(true);
    try { await fetcher(viewer?.kind === 'user' ? '/api/user/settings' : '/api/guest/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: { [service]: null } }) }); await refresh(); window.dispatchEvent(new Event('aistory:settings')); setMessage(`${service === 'openAi' ? 'OpenAI' : 'Together AI'} key removed.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not remove key.'); } finally { setBusy(false); }
  }
  if (!viewer || viewer.isAdmin) return null;
  const textWarn = viewer?.textFunding === 'trial' && viewer.remaining && viewer.remaining.text <= 4;
  const audioWarn = viewer?.audioFunding === 'trial' && viewer.remaining && viewer.remaining.audio <= 2000;
  return <>
    {viewer && viewer.kind !== 'visitor' && <div className="mx-8 mt-4 rounded border border-border bg-card p-3 text-sm text-muted-foreground">
      {viewer.kind === 'guest' && <>Guest work expires {new Date(viewer.expiresAt!).toLocaleDateString()}. <SignInToKeepLink className="underline" />. </>}
      {viewer.remaining && <>Free trial: {viewer.remaining.text} text calls, {viewer.remaining.audio} audio characters left. </>}
      <button className="text-primary underline" onClick={() => setOpen(true)}>Use your own API key</button>
    </div>}
    {!dismissed && (textWarn || audioWarn) && <div role="status" className="mx-8 mt-2 rounded border border-amber-500 p-3 text-sm">
      {textWarn && `You have ${viewer!.remaining!.text} free text generations left. `}{audioWarn && `You have ${viewer!.remaining!.audio} free audio characters left. `}
      <button className="text-primary underline" onClick={() => setOpen(true)}>Use your own API key</button><button className="ml-4" aria-label="Dismiss allowance reminder" onClick={() => { sessionStorage.setItem('aistory-reminder-dismissed', '1'); setDismissed(true); }}>Dismiss</button>
    </div>}
    {open && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Use your own API key"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-card p-6 text-foreground">
      <div className="flex justify-between"><h2 className="text-xl font-semibold">Keep creating with your own API key</h2><button onClick={() => setOpen(false)} aria-label="Close API key guide">×</button></div>
      <p className="mt-3 text-sm">Add a Together AI or OpenAI API key to continue generating beyond AiStory’s free trial allowance. No AiStory sign-up is required. Usage is billed to your provider account, and provider limits still apply.</p>
      <p className="mt-2 text-sm">{viewer?.kind === 'user' ? 'Your books and templates are saved to your Google account.' : 'Your guest workspace still expires after seven days. Sign in with Google to keep your books and templates.'}</p>
      <div className="mt-4 text-sm"><p><strong>Together AI:</strong> Story generation and audio. <a className="text-primary underline" target="_blank" rel="noreferrer" href="https://support.together.ai/articles/4999040689-where-to-find-your-api-key">Find or create a Together API key</a>.</p><p className="mt-2"><strong>OpenAI:</strong> Story generation. <a className="text-primary underline" target="_blank" rel="noreferrer" href="https://developers.openai.com/api/docs/quickstart">OpenAI API-key quickstart</a>.</p></div>
      <ol className="mt-4 list-inside list-decimal text-sm"><li>Create a provider account, set up billing or credits, and create a key.</li><li>Paste it into the matching field below.</li><li>Select a text provider/model and choose Save & test. Testing may incur a small provider charge.</li></ol>
      <p className="mt-3 text-xs text-muted-foreground">Audio specifically requires a Together key to bypass the free audio allowance.</p>
      {(['together', 'openAi'] as const).map((service) => <div key={service} className="mt-3"><label className="block text-sm">{service === 'together' ? 'Together AI' : 'OpenAI'} key {viewer?.personal?.[service] ? '(configured)' : ''}<input className="mt-1 w-full rounded border border-border bg-background p-2" type="password" autoComplete="off" value={keys[service]} onChange={(event) => setKeys((previous) => ({ ...previous, [service]: event.target.value }))} placeholder="Paste a new key to replace the current one" /></label>{viewer?.personal?.[service] && <button disabled={busy} className="mt-1 text-xs text-red-400 underline" onClick={() => remove(service)}>Remove key</button>}</div>)}
      <label className="mt-3 block text-sm">Text provider<select className="mt-1 w-full rounded border border-border bg-background p-2" value={provider} onChange={(event) => { setProvider(event.target.value as 'together' | 'openAi'); setModel(''); setModels([]); }}><option value="together">Together AI</option><option value="openAi">OpenAI</option></select></label>
      <label className="mt-3 block text-sm">Model<input list="guest-models" className="mt-1 w-full rounded border border-border bg-background p-2" value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model ID" /><datalist id="guest-models">{models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</datalist></label>
      <div className="mt-4 flex gap-3"><button disabled={busy} className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={() => save(false)}>Save</button><button disabled={busy} className="rounded border border-border px-3 py-2" onClick={() => save(true)}>Save & test</button><button disabled={busy} className="rounded border border-border px-3 py-2" onClick={() => void loadModels()}>Load models</button></div>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </div></div>}
  </>;
}
