'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  JsonValue,
  LongTermMemoryProposal,
  LongTermMemoryState,
  MemoryProposalMode,
} from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/Button';
import { Textarea } from '@/components/Textarea';
import { useFetcher } from '@/components/FetcherProvider';
import {
  applyMemoryPatch,
  getMemoryValueAtPath,
  parseMemoryPatchOperations,
  validateLongTermMemoryContent,
} from '@/lib/bookMemory';
import { formatErrorDetail, getErrorEnvelope } from '@/lib/errorClient';

interface LongTermMemoryModalProps {
  open: boolean;
  bookId: string;
  memory: LongTermMemoryState;
  onClose: () => void;
  onMemoryChange: (memory: LongTermMemoryState) => void;
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const formatValue = (value: JsonValue | undefined) => value === undefined ? '(not present)' : pretty(value);

type Notice = { type: 'error' | 'success' | 'info'; text: string };

const formatRequestFailure = (error: unknown, context: string) => {
  const envelopeDetail = formatErrorDetail(getErrorEnvelope(error));
  const thrownDetail = error instanceof Error
    ? `${error.name}: ${error.message}${error.stack ? `\n\n${error.stack}` : ''}`
    : String(error);
  return `${context}\n\n${envelopeDetail ?? thrownDetail}`;
};

export default function LongTermMemoryModal(props: LongTermMemoryModalProps) {
  const { fetcher } = useFetcher();
  const [view, setView] = useState<'editor' | 'review'>('editor');
  const [memoryText, setMemoryText] = useState(pretty(props.memory.content));
  const [proposal, setProposal] = useState<LongTermMemoryProposal | null>(null);
  const [patchText, setPatchText] = useState('[]');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!props.open) return;
    setView('editor');
    setMemoryText(pretty(props.memory.content));
    setProposal(null);
    setPatchText('[]');
    setNotice(null);
  }, [props.open, props.memory]);

  const parsedEditor = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(memoryText);
      return validateLongTermMemoryContent(parsed);
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : 'Memory JSON is invalid.' };
    }
  }, [memoryText]);

  const parsedReview = useMemo(() => {
    if (!proposal) return { ok: false as const, message: 'No proposal is loaded.' };
    try {
      const parsed: unknown = JSON.parse(patchText);
      const operationsResult = parseMemoryPatchOperations(parsed);
      if (!operationsResult.ok) return operationsResult;
      const applied = applyMemoryPatch(props.memory.content, operationsResult.value);
      if (!applied.ok) return applied;
      return { ok: true as const, operations: operationsResult.value, content: applied.value };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : 'Patch JSON is invalid.' };
    }
  }, [patchText, proposal, props.memory.content]);

  const semanticChanges = useMemo(() => {
    if (!parsedReview.ok) return [];
    return parsedReview.operations.map((operation, index) => ({
      index,
      operation,
      before: getMemoryValueAtPath(props.memory.content, operation.path),
      after: getMemoryValueAtPath(parsedReview.content, operation.path),
    }));
  }, [parsedReview, props.memory.content]);

  const saveManualMemory = async () => {
    if (!parsedEditor.ok) {
      setNotice({ type: 'error', text: parsedEditor.message });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const memory = await fetcher<LongTermMemoryState>(`/api/books/${props.bookId}/memory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevision: props.memory.revision, content: parsedEditor.value }),
        silent: true,
      });
      props.onMemoryChange(memory);
      setMemoryText(pretty(memory.content));
      setNotice({ type: 'success', text: 'Memory saved.' });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      setNotice({
        type: 'error',
        text: formatRequestFailure(
          error,
          status === 409
            ? 'Memory changed elsewhere. Reload the book before saving.'
            : 'Memory was not saved.',
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  const generateProposal = async (mode: MemoryProposalMode) => {
    setBusy(true);
    setNotice(null);
    try {
      const nextProposal = await fetcher<LongTermMemoryProposal>(`/api/books/${props.bookId}/memory/proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, baseRevision: props.memory.revision }),
        silent: true,
      });
      setProposal(nextProposal);
      setPatchText(pretty(nextProposal.operations));
      setView('review');
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      setNotice({
        type: 'error',
        text: formatRequestFailure(
          error,
          status === 409
            ? 'The checkpoint is stale or there is no new accepted narration. Use Full rescan when earlier prose changed.'
            : 'The proposal could not be generated.',
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  const acceptProposal = async () => {
    if (!proposal || !parsedReview.ok) return;
    setBusy(true);
    setNotice(null);
    try {
      const memory = await fetcher<LongTermMemoryState>(`/api/books/${props.bookId}/memory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseRevision: proposal.baseRevision,
          operations: parsedReview.operations,
          source: proposal.source,
        }),
        silent: true,
      });
      props.onMemoryChange(memory);
      setMemoryText(pretty(memory.content));
      setProposal(null);
      setView('editor');
      setNotice({ type: 'success', text: 'Memory proposal accepted.' });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      setNotice({
        type: 'error',
        text: formatRequestFailure(
          error,
          status === 409
            ? 'This proposal is stale because the memory or source narration changed. Keep a copy of your patch and generate it again.'
            : 'The proposal was not accepted.',
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Long-term book memory"
      open={props.open}
      onCancel={props.onClose}
      cancelText="Close"
      width={1100}
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Revision {props.memory.revision}</span>
        <span>{Object.keys(props.memory.content.entries).length} entries</span>
        <span>Processed through: {props.memory.checkpoint.throughSegmentId ?? 'nothing yet'}</span>
        <span>Updated: {props.memory.updatedAt ? new Date(props.memory.updatedAt).toLocaleString() : 'never'}</span>
      </div>

      {notice && (
        <div className={`mb-3 max-h-72 overflow-auto rounded-md border px-3 py-2 text-sm ${
          notice.type === 'error'
            ? 'border-destructive/70 bg-destructive/10 text-destructive'
            : 'border-border bg-muted/60'
        }`}>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs">{notice.text}</pre>
        </div>
      )}

      {view === 'editor' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Edit the schema-versioned memory JSON directly. Saving manual edits does not advance the narration checkpoint.
          </p>
          <Textarea
            aria-label="Long-term memory JSON"
            className="min-h-[430px] font-mono text-xs"
            value={memoryText}
            onChange={(event) => {
              setMemoryText(event.target.value);
              setNotice(null);
            }}
            disabled={busy}
          />
          {!parsedEditor.ok && <p className="text-sm text-destructive">{parsedEditor.message}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !parsedEditor.ok}
              onClick={() => parsedEditor.ok && setMemoryText(pretty(parsedEditor.value))}
            >
              Validate / Format
            </Button>
            <Button type="button" variant="primary" disabled={busy || !parsedEditor.ok} onClick={() => void saveManualMemory()}>
              Save memory
            </Button>
            <Button type="button" disabled={busy} onClick={() => void generateProposal('incremental')}>
              {busy ? 'Working...' : 'Update from new content'}
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => void generateProposal('full')}>
              Full rescan
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Proposed changes</h3>
            {semanticChanges.length === 0 && parsedReview.ok ? (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                No memory values changed. Accepting will still advance the processed narration checkpoint.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {semanticChanges.map(({ index, operation, before, after }) => (
                  <div
                    key={`${index}-${operation.path}`}
                    className={`rounded-md border p-3 ${operation.op === 'remove' ? 'border-destructive/70 bg-destructive/10' : 'border-border bg-card/60'}`}
                  >
                    <div className="mb-2 flex items-center gap-2 font-mono text-xs">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-semibold uppercase">{operation.op}</span>
                      <span className="break-all">{operation.path}</span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">{formatValue(before)}</pre>
                      <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs">{formatValue(after)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Editable JSON Patch</h3>
            <Textarea
              aria-label="Long-term memory JSON Patch"
              className="min-h-64 font-mono text-xs"
              value={patchText}
              onChange={(event) => {
                setPatchText(event.target.value);
                setNotice(null);
              }}
              disabled={busy}
            />
            {!parsedReview.ok && <p className="mt-2 text-sm text-destructive">{parsedReview.message}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" disabled={busy || !parsedReview.ok} onClick={() => void acceptProposal()}>
              {busy ? 'Accepting...' : 'Accept proposal'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setProposal(null);
                setView('editor');
                setNotice({ type: 'info', text: 'Proposal rejected; memory was not changed.' });
              }}
            >
              Reject proposal
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
