'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import {
  clearAiApiLogs,
  createAiApiLogDownload,
  getAiApiLogResponsePreview,
  subscribeToAiApiLogs,
} from '@/lib/aiApiLog';
import { getSegmentAudio, playAudioBlob } from '@/lib/ttsIndexedDb';
import type { AiApiLogEntry } from '@/types';

const formatTimestamp = (timestamp: number) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'short',
  timeStyle: 'medium',
}).format(timestamp);

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const getPayloadInput = (entry: AiApiLogEntry) => {
  if (!entry.payload || typeof entry.payload !== 'object' || Array.isArray(entry.payload)) return null;
  const input = entry.payload.input;
  return typeof input === 'string' ? input : null;
};

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function AiApiLogDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState<AiApiLogEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);

  useEffect(() => subscribeToAiApiLogs(setEntries), []);

  useEffect(() => {
    if (selectedId && !entries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [entries, selectedId]);

  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;

  const closeLogs = () => {
    setSelectedId(null);
    setAudioMessage(null);
    onClose();
  };

  const playLoggedAudio = async (entry: AiApiLogEntry) => {
    if (!entry.audio) return;
    setAudioMessage(null);

    try {
      const record = await getSegmentAudio(entry.audio.segmentId);
      const loggedInput = getPayloadInput(entry);
      if (!record || record.configId !== entry.audio.configId || (loggedInput !== null && record.content !== loggedInput)) {
        setAudioMessage('The audio cache for this log is no longer available.');
        return;
      }

      await playAudioBlob(entry.audio.segmentId, record.audioBlob);
      setAudioMessage('Playing cached audio.');
    } catch (error) {
      setAudioMessage(error instanceof Error ? error.message : 'Unable to play cached audio.');
    }
  };

  const downloadLlmLog = (entry: AiApiLogEntry) => {
    const download = createAiApiLogDownload(entry);
    const url = URL.createObjectURL(new Blob([download.content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = download.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 transition-opacity" onClick={closeLogs} />}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl transform flex-col border-l border-border bg-card transition-transform duration-300 ease-in-out sm:w-[32rem] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-bold text-secondary">AI API Logs</h2>
            <p className="text-xs text-muted-foreground">Stored only in this browser</p>
          </div>
          <button onClick={closeLogs} className="rounded p-1 hover:bg-muted" aria-label="Close AI API logs">
            <CloseIcon />
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">{entries.length} / 100 retained</span>
          <Button type="button" variant="outline" size="small" onClick={clearAiApiLogs} disabled={entries.length === 0}>
            Clear all
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {entries.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No book-generation AI calls have been logged yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => {
                const responsePreview = getAiApiLogResponsePreview(entry);

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(entry.id);
                      setAudioMessage(null);
                    }}
                    className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted ${selectedId === entry.id ? 'border-primary bg-muted' : 'border-border'}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{entry.feature}</span>
                      <span className={entry.status === 'success' ? 'text-green-500' : 'text-red-500'}>{entry.status}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      <span>{entry.kind.toUpperCase()}</span>
                      <span>{entry.bookName?.trim() || 'Untitled book'}</span>
                      <span>{formatTimestamp(entry.createdAt)}</span>
                      <span>{entry.durationMs} ms</span>
                    </div>
                    {responsePreview && <p className="mt-2 truncate text-xs text-muted-foreground">{responsePreview}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {selectedEntry && (
        <aside
          className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-border bg-card shadow-xl lg:right-[32rem] lg:w-[32rem]"
          aria-label="AI API log details"
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="text-lg font-bold text-secondary">Call details</h3>
            <button onClick={() => setSelectedId(null)} className="rounded p-1 hover:bg-muted" aria-label="Close call details">
              <CloseIcon />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Book</dt><dd>{selectedEntry.bookName?.trim() || 'Untitled book'}</dd>
              <dt className="text-muted-foreground">Book ID</dt><dd className="break-all">{selectedEntry.bookId || '—'}</dd>
              <dt className="text-muted-foreground">Feature</dt><dd>{selectedEntry.feature}</dd>
              <dt className="text-muted-foreground">HTTP status</dt><dd>{selectedEntry.httpStatus ?? '—'}</dd>
              <dt className="text-muted-foreground">Duration</dt><dd>{selectedEntry.durationMs} ms</dd>
            </dl>

            {selectedEntry.kind === 'llm' && (
              <Button type="button" variant="outline" size="small" className="mt-4" onClick={() => downloadLlmLog(selectedEntry)}>
                Download JSON
              </Button>
            )}

            {selectedEntry.audio && (
              <div className="mt-4 rounded border border-border p-2">
                <div className="text-xs text-muted-foreground">Cached audio · {selectedEntry.audio.mimeType} · {selectedEntry.audio.byteSize} bytes</div>
                <Button type="button" variant="secondary" size="small" className="mt-2" onClick={() => void playLoggedAudio(selectedEntry)}>
                  Play cached audio
                </Button>
                {audioMessage && <p className="mt-2 text-xs text-muted-foreground">{audioMessage}</p>}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div><h4 className="mb-1 text-xs font-semibold">Payload</h4><pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">{formatJson(selectedEntry.payload)}</pre></div>
              {selectedEntry.response !== undefined && <div><h4 className="mb-1 text-xs font-semibold">Response</h4><pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">{formatJson(selectedEntry.response)}</pre></div>}
              {selectedEntry.error !== undefined && <div><h4 className="mb-1 text-xs font-semibold text-red-500">Error</h4><pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">{formatJson(selectedEntry.error)}</pre></div>}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
