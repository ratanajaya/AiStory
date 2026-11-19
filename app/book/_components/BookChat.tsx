'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';
import Modal from '@/components/Modal';
import { Textarea } from '@/components/Textarea';
import { streamAiRequest } from '@/lib/aiStreamClient';
import { createBookChatRequest, type BookChatExchange } from '@/lib/bookChatRequest';
import type { Book, LlmConfig, Template } from '@/types';
import _constant from '@/utils/_constant';

const starterQuestions = [
  'Review the current story',
  'Where do you think it should go next?',
];

interface ChatReply extends BookChatExchange {
  model?: LlmConfig | null;
}

function Exchange({ reply, streaming = false }: { reply: ChatReply; streaming?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="ml-6 self-end rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">You</p>
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{reply.question}</p>
      </div>
      <div className="mr-6 self-start rounded-lg border border-border bg-card px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground [overflow-wrap:anywhere]">
          {reply.model ? `${_constant.llmServices[reply.model.service].label} · ${reply.model.model}` : 'Assistant'}
        </p>
        {reply.answer ? (
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{reply.answer}</p>
        ) : streaming && <p className="text-muted-foreground">Waiting for reply…</p>}
      </div>
    </div>
  );
}

export default function BookChat({ book, template }: { book: Book; template: Template | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<ChatReply[]>([]);
  const [pending, setPending] = useState<BookChatExchange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const followLatest = useRef(true);

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  useEffect(() => {
    if (open && transcript.current && followLatest.current) {
      transcript.current.scrollTop = transcript.current.scrollHeight;
    }
  }, [open, history, pending]);

  const send = async () => {
    const question = draft.trim();
    if (!template || !question || activeRequest.current) return;

    const controller = new AbortController();
    activeRequest.current = controller;
    followLatest.current = true;
    setPending({ question, answer: '' });
    setError(null);
    setDraft('');

    let model: LlmConfig | null = null;
    try {
      const request = createBookChatRequest(template, book, question, history);
      const answer = await streamAiRequest(request, {
        signal: controller.signal,
        onModel: (selected) => { model = selected; },
        onChunk: (chunk) => {
          if (activeRequest.current === controller) {
            setPending((previous) => previous && { ...previous, answer: previous.answer + chunk });
          }
        },
      });
      if (activeRequest.current === controller) {
        setHistory((previous) => [...previous, { question, answer, model }]);
      }
    } catch (err) {
      if (activeRequest.current === controller) {
        setError(err instanceof Error ? err.message : 'Could not get a reply. Try again.');
        setDraft(question);
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPending(null);
      }
    }
  };

  return (
    <>
      <Button type="button" size="small" variant="outline" aria-haspopup="dialog" disabled={!template}
        onClick={() => { followLatest.current = true; setOpen(true); }}>
        Chat
      </Button>
      <Modal open={open} title="Book chat" onCancel={() => setOpen(false)} cancelText="Close">
        <div className="space-y-4">
          {history.length === 0 && !pending && (
            <div className="flex flex-wrap gap-2">
              {starterQuestions.map((question) => (
                <Button key={question} type="button" size="small" variant="outline" className="h-auto text-left"
                  onClick={() => { setDraft(question); setError(null); composer.current?.focus(); }}>
                  {question}
                </Button>
              ))}
            </div>
          )}
          {(history.length > 0 || pending) && (
            <div ref={transcript} role="log" aria-label="Conversation" aria-relevant="additions" tabIndex={0}
              className="max-h-[45dvh] space-y-3 overflow-y-auto overscroll-contain rounded-md pr-1 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              onScroll={(event) => {
                const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
                followLatest.current = scrollHeight - scrollTop - clientHeight < 32;
              }}>
              {history.map((reply, index) => <Exchange key={index} reply={reply} />)}
              {pending && <Exchange reply={pending} streaming />}
            </div>
          )}
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <Textarea ref={composer} rows={2} className="resize-none" aria-label="Chat message"
              placeholder="Ask about your story" value={draft} readOnly={Boolean(pending)}
              onChange={(event) => { setDraft(event.target.value); setError(null); }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }} />
            {error && <p role="alert" className="text-sm text-destructive [overflow-wrap:anywhere]">{error}</p>}
            <div className="flex justify-end gap-2">
              {history.length > 0 && (
                <Button type="button" variant="ghost" size="small" disabled={Boolean(pending)} onClick={() => {
                  setHistory([]);
                  setDraft('');
                  setError(null);
                  composer.current?.focus();
                }}>New chat</Button>
              )}
              <Button type="submit" size="small" disabled={!template || Boolean(pending) || !draft.trim()}>Send</Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
