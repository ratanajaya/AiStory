"use client";

import TrialActionNotice from '@/app/_components/TrialActionNotice';
import { useMemo } from 'react';
import { useUiState } from '@/components/UiStateProvider';
import { useBookAudio, useAudioStatus } from '@/app/book/_components/BookAudioProvider';
import { formatAudioTime } from '@/lib/ttsAudioClient';
import type { Chapter, StorySegment } from '@/types';

export default function BookAudioControl(props: {
  segments: StorySegment[]; chapters: Chapter[]; bookId: string; bookName: string | null; disabled?: boolean;
}) {
  const { manager, playback, generation } = useBookAudio();
  const playbackStatus = useAudioStatus();
  const { uiState, setBookAudioHidden } = useUiState();
  const playableSegments = useMemo(() => props.segments.filter(segment => segment.role === 'assistant' && segment.content.trim()), [props.segments]);
  const isQueueActive = playback.mode === 'book' && !['idle', 'error'].includes(playback.state);
  const isQueueLoading = isQueueActive && playback.state === 'loading';
  const isQueuePlaying = isQueueActive && playback.state === 'playing';
  const isQueuePaused = isQueueActive && playback.state === 'paused';
  const currentQueueSegmentId = isQueueActive ? playback.part?.segmentId ?? playback.targetSegmentId : null;
  const queueTotal = isQueueActive ? playableSegments.length : 0;
  const queueProgressLabel = `${Math.max(0, playableSegments.findIndex(segment => segment.id === currentQueueSegmentId)) + 1}/${queueTotal}`;
  const canStartQueue = !props.disabled && playableSegments.length > 0;
  const canStopQueue = isQueueActive && !props.disabled;
  const currentPart = isQueueActive ? playback.part : null;
  const audioTimeLabel = currentPart ? `Part ${currentPart.partIndex + 1}/${currentPart.partCount} · ${
    playbackStatus.chunkKey === currentPart.key ? `${formatAudioTime(playbackStatus.currentTime)} / ${formatAudioTime(playbackStatus.duration)}` : 'Preparing'
  }` : null;
  const playableSegmentEntries = useMemo(() => {
    const titles = new Map(props.chapters.map(chapter => [chapter.id, chapter.title]));
    const label = (segment: StorySegment) => segment.chapterId ? titles.get(segment.chapterId) ?? 'No Chapter' : 'No Chapter';
    return playableSegments.map((segment, index) => {
      const barrierLabel = label(segment);
      const showBarrier = index === 0 || barrierLabel !== label(playableSegments[index - 1]);
      return { segment, index, barrierLabel, showBarrier };
    });
  }, [playableSegments, props.chapters]);
  const start = (index = 0) => {
    window.dispatchEvent(new Event('aistory:audio-interrupt'));
    void manager.play(playableSegments.slice(index), 'book');
  };
  const stopQueue = () => manager.stop();
  const jumpToSegment = (index: number) => { if (!props.disabled) start(index); };
  const handleMainAction = () => {
    if (props.disabled) return;
    if (isQueuePlaying || isQueueLoading) manager.pause();
    else if (isQueuePaused) void manager.resume();
    else start();
  };

  if (uiState.bookAudioHidden) {
    return (
      <button
        type="button"
        aria-label="Show Book Audio"
        onClick={() => setBookAudioHidden(false)}
        className="fixed bottom-4 right-4 z-20 rounded-md border border-border bg-card p-2 text-foreground transition-all hover:brightness-125 cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 5 6 9H3v6h3l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-20 h-96 w-80 rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-sm">
      <div className="flex h-full flex-col p-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>Book Audio</span>
          <button
            type="button"
            aria-label="Hide Book Audio"
            onClick={() => setBookAudioHidden(true)}
            className="rounded p-1 hover:bg-muted"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 9a1 1 0 100 2h10a1 1 0 100-2H5z" />
            </svg>
          </button>
        </div>

        <TrialActionNotice kind="audio" />
        <button type="button" className="my-2 rounded border border-border px-2 py-1 text-sm disabled:opacity-50"
          disabled={!canStartQueue || generation.state === 'generating'}
          onClick={() => void manager.generate(playableSegments)}>
          {generation.state === 'generating' ? 'Generating book audio...' : generation.state === 'paused' ? 'Retry generation' : 'Generate book audio'}
        </button>
        {generation.state !== 'idle' && <p role="status" className="text-xs text-muted-foreground">
          {generation.completed}/{generation.total} parts · {generation.state === 'paused' ? 'Paused on error' : generation.state === 'complete' ? 'Complete' : 'Generating'}
        </p>}
        {generation.error && <p role="alert" className="text-xs text-red-400">{generation.error}</p>}
        {playback.mode === 'book' && playback.error && <p role="alert" className="text-xs text-red-400">{playback.error}</p>}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMainAction}
              aria-label={isQueuePlaying || isQueueLoading ? "Pause book audio" : "Play book audio"}
              className="bg-muted/70 hover:bg-muted p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canStartQueue}
            >
              {isQueueLoading ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground animate-spin" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-13a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : isQueuePlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 4a1 1 0 00-1 1v10a1 1 0 102 0V5A1 1 0 006 4z" />
                  <path d="M14 4a1 1 0 00-1 1v10a1 1 0 102 0V5a1 1 0 00-1-1z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.5 4.5a1 1 0 011.537-.843l6 4A1 1 0 0114 9.343l-6 4A1 1 0 016.5 12.5v-8z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={stopQueue}
              aria-label="Stop book audio"
              className="bg-muted/70 hover:bg-muted p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canStopQueue}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H7a1 1 0 01-1-1V6z" />
              </svg>
            </button>
          </div>

          <div className="text-center text-[11px] leading-4 text-muted-foreground">
            <div>{queueTotal > 0 ? queueProgressLabel : `${playableSegments.length} segments`}</div>
            <div>{audioTimeLabel || (isQueueActive ? 'Queued' : 'Ready')}</div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/60 bg-background/60 p-1.5">
            <div className="flex flex-col gap-1">
              {playableSegmentEntries.map(({ segment, index, barrierLabel, showBarrier }) => {
                const isCurrent = segment.id === currentQueueSegmentId;

                return (
                  <div key={segment.id}>
                    {showBarrier && (
                      <div className="px-2 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground first:pt-0 border-b">
                        {barrierLabel}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => jumpToSegment(index)}
                      disabled={props.disabled}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isCurrent ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{`Segment ${index + 1}`}</span>
                        {isCurrent && (
                          <span className="text-[11px] uppercase tracking-wide">
                            {isQueuePlaying ? 'Playing' : isQueuePaused ? 'Paused' : isQueueLoading ? 'Loading' : 'Queued'}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
