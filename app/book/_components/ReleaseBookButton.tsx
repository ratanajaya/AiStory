'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import Modal from '@/components/Modal';
import { useFetcher } from '@/components/FetcherProvider';
import SignInToKeepLink from '@/app/_components/SignInToKeepLink';
import { collectReleaseAudio } from '@/lib/releaseAudioClient';
import { useHasOpenEdits } from '@/lib/useSignInEditGuard';
import type { ReleaseAttemptResponse, ReleaseFile } from '@/lib/releaseTypes';
export default function ReleaseBookButton({ bookId, disabled, onBusyChange }: { bookId: string; disabled: boolean; onBusyChange: (busy: boolean) => void }) {
  const { fetcher } = useFetcher(); const openEdits = useHasOpenEdits();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [guest, setGuest] = useState(false);
  const [error, setError] = useState(''); const [progress, setProgress] = useState(''); const [result, setResult] = useState('');
  const [preview, setPreview] = useState<{ attempt: ReleaseAttemptResponse; audio: Awaited<ReturnType<typeof collectReleaseAudio>> } | null>(null);
  const controller = useRef<AbortController | null>(null); const running = useRef(false);
  useEffect(() => () => { controller.current?.abort(); }, []);
  async function prepare() {
    if (running.current || disabled || openEdits) return;
    running.current = true; setOpen(true); setBusy(true); setError(''); setResult(''); setPreview(null); setGuest(false); onBusyChange(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      const viewer = await fetcher<{ kind: string }>('/api/viewer', { signal: abort.signal });
      if (viewer.kind !== 'user') { setGuest(true); onBusyChange(false); return; }
      const attempt = await fetcher<ReleaseAttemptResponse>(`/api/books/${bookId}/release`, { method: 'POST', signal: abort.signal });
      const audio = await collectReleaseAudio(attempt, abort.signal);
      if (audio.files.reduce((sum, file) => sum + file.blob.size, 0) > 100 * 1024 * 1024) throw new Error('Release audio exceeds 100 MiB.');
      setPreview({ attempt, audio });
    } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not prepare release. Please retry.'); }
    finally { running.current = false; setBusy(false); }
  }
  async function publish() {
    if (!preview || running.current) return;
    running.current = true; setBusy(true); setError('');
    const signal = controller.current!.signal;
    try {
      const { attempt, audio } = preview;
      const response = await fetcher<{ uploads: Array<ReleaseFile & { url: string }> }>(`/api/release-attempts/${attempt.attemptId}/uploads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: audio.files.map(file => file.manifest) }), signal,
      });
      for (const [index, upload] of response.uploads.entries()) {
        setProgress(`Uploading audio ${index + 1} of ${response.uploads.length}`);
        const sent = await fetch(upload.url, { method: 'PUT', headers: { 'Content-Type': upload.mimeType }, body: audio.files[index].blob, signal });
        if (!sent.ok) throw new Error('Audio upload failed. Please retry the release.');
      }
      setProgress('Publishing release...');
      const saved = await fetcher<{ releaseId: string }>(`/api/release-attempts/${attempt.attemptId}/commit`, { method: 'POST', signal });
      setResult(saved.releaseId); setPreview(null); setProgress('');
    } catch (cause) { if (!signal.aborted) { setError(cause instanceof Error ? cause.message : 'Release failed. Please retry.'); setPreview(null); setProgress(''); } }
    finally { running.current = false; setBusy(false); }
  }
  function close() { if (busy) return; controller.current?.abort(); setOpen(false); setPreview(null); onBusyChange(false); }
  return <>
    <Button variant="outline" size="small" disabled={disabled || openEdits || busy} onClick={() => void prepare()}>Release</Button>
    <Modal open={open} title="Release book" onCancel={busy ? undefined : close} width={560}>
      {guest ? <><p className="mb-4">Sign in and claim your book to create a permanent release.</p><SignInToKeepLink onNavigate={close}>Sign in to release</SignInToKeepLink></> : <>
        {busy && <p role="status">{progress || 'Preparing saved story and cached audio...'}</p>}
        {error && <p role="alert" className="mb-4 text-red-500">{error}</p>}
        {preview && <div className="space-y-3">
          <p className="font-semibold">{preview.attempt.title}</p>
          <p>{preview.attempt.segments.length} saved segments; {preview.audio.files.length} of {preview.audio.expectedParts} audio parts available.</p>
          <p className="text-sm text-muted-foreground">Only saved assistant text and audio for your current voice/model will be copied. Missing audio will stay missing.</p>
          {preview.attempt.replacing && <p className="text-sm">This replaces the previous release at the same URL, including its audio. Recordings absent from this browser cache will be removed from the release.</p>}
          <Button disabled={busy} onClick={() => void publish()}>{preview.attempt.replacing ? 'Replace release' : 'Release book'}</Button>
        </div>}
        {error && !busy && <Button onClick={() => void prepare()}>Retry release</Button>}
        {result && <p>Released successfully. <Link className="text-primary underline" href={`/released-books/${result}`}>Open released book</Link></p>}
      </>}
    </Modal>
  </>;
}
