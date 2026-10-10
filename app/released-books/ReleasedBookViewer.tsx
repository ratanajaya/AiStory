'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Markdown from 'react-markdown';
import { Button } from '@/components/Button';
import { useFetcher } from '@/components/FetcherProvider';
interface ViewerSegment { id: string; content: string; expectedAudioParts: number; audio: Array<{ partIndex: number; mimeType: string; url: string }> }
interface ViewerBook { releaseId: string; title: string; releasedAt: string; revision: number; segments: ViewerSegment[] }
interface PlayPart { segmentIndex: number; partIndex: number; url: string }
export default function ReleasedBookViewer({ releaseId }: { releaseId: string }) {
  const { fetcher } = useFetcher(); const [book, setBook] = useState<ViewerBook | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [audioError, setAudioError] = useState('');
  const [current, setCurrent] = useState<PlayPart | null>(null); const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null); const queue = useRef<PlayPart[]>([]); const index = useRef(0); const epoch = useRef(0);
  useEffect(() => {
    const controller = new AbortController(); const audio = audioRef.current;
    const playbackEpoch = epoch; const playbackQueue = queue;
    fetcher<ViewerBook>(`/api/released-books/${releaseId}`, { signal: controller.signal, silent: true }).then(setBook).catch((cause: { statusCode?: number }) => {
      if (!controller.signal.aborted) setError(cause.statusCode === 401 || cause.statusCode === 403 ? 'Sign in as the owner to view this release.' : cause.statusCode === 404 ? 'Released book not found.' : 'Could not load this release. Refresh to retry.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); playbackEpoch.current++; playbackQueue.current = []; if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } };
  }, [releaseId, fetcher]);
  function stop() {
    epoch.current++; queue.current = []; setCurrent(null); setPlaying(false);
    const audio = audioRef.current; if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  }
  function fail() { stop(); setAudioError('Audio playback failed. If this release was replaced, refresh the viewer.'); }
  function playPart() {
    const part = queue.current[index.current]; const audio = audioRef.current;
    if (!part || !audio) { stop(); return; }
    const token = ++epoch.current; audio.pause(); audio.src = part.url; audio.load(); setCurrent(part); setAudioError('');
    void audio.play().catch(() => { if (epoch.current === token) fail(); });
  }
  function start(segmentIndex?: number) {
    if (!book) return;
    window.dispatchEvent(new Event('aistory:audio-interrupt'));
    queue.current = book.segments.flatMap((segment, i) => segmentIndex === undefined || segmentIndex === i
      ? [...segment.audio].sort((a, b) => a.partIndex - b.partIndex).map(part => ({ segmentIndex: i, partIndex: part.partIndex, url: part.url })) : []);
    index.current = 0; playPart();
  }
  function toggle() {
    const audio = audioRef.current; if (!audio || !current) return;
    if (audio.paused) { const token = epoch.current; void audio.play().catch(() => { if (epoch.current === token) fail(); }); }
    else audio.pause();
  }
  return <main className="mx-auto max-w-3xl px-4 py-8">
    <Link href="/" className="text-primary hover:underline">Back to Library</Link>
    {loading && <p role="status" className="mt-6">Loading released book...</p>}
    {error && <p role="alert" className="mt-6">{error}</p>}
    {book && <>
      <h1 className="text-3xl font-bold mt-6">{book.title}</h1>
      <p className="text-sm text-muted-foreground mt-2">Released {new Date(book.releasedAt).toLocaleString()}</p>
      <div className="my-6 space-y-3 rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-2">
          <Button size="small" disabled={!book.segments.some(s => s.audio.length)} onClick={() => start()}>Play All</Button>
          <Button size="small" variant="outline" disabled={!current} onClick={toggle}>{playing ? 'Pause' : 'Resume'}</Button>
          <Button size="small" variant="outline" disabled={!current} onClick={stop}>Stop</Button>
        </div>
        {current && <p role="status">Segment {current.segmentIndex + 1}, part {current.partIndex + 1}/{book.segments[current.segmentIndex].expectedAudioParts}</p>}
        {audioError && <p role="alert" className="text-red-500">{audioError}</p>}
      </div>
      {book.segments.length === 0 && <p>No story segments in this release.</p>}
      {book.segments.map((segment, i) => <section key={segment.id} aria-label={`Segment ${i + 1}`} className="border-b border-border py-6">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Segment {i + 1}</h2>
          {segment.audio.length > 0 ? <Button variant="outline" size="small" onClick={() => start(i)}>Play segment {i + 1}</Button> : <span className="text-xs text-muted-foreground">No audio</span>}
        </div>
        {segment.audio.length > 0 && segment.audio.length < segment.expectedAudioParts && <p className="text-xs text-muted-foreground mb-3">Incomplete audio: {segment.audio.length}/{segment.expectedAudioParts} parts available.</p>}
        <div className="prose prose-invert max-w-none leading-relaxed whitespace-pre-wrap"><Markdown>{segment.content}</Markdown></div>
      </section>)}
    </>}
    <audio ref={audioRef} controls preload="none" aria-label="Released book audio" className={`w-full my-4 ${current ? '' : 'hidden'}`}
      onEnded={() => { index.current++; playPart(); }} onError={() => { if (queue.current.length) fail(); }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
  </main>;
}
