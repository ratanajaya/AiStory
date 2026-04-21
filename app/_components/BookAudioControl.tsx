'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useAlert } from "@/components/AlertBox";
import { ensureSegmentAudioBlob, formatAudioTime } from "@/lib/ttsAudioClient";
import {
  AudioPlaybackStatus,
  pauseAudioPlayback,
  playAudioBlob,
  resumeAudioPlayback,
  stopAudioPlayback,
  subscribeToAudioPlayback,
} from "@/lib/ttsIndexedDb";
import { StorySegment } from "@/types";

type QueuePlaybackResult = 'completed' | 'stopped' | 'interrupted';
type PrefetchedAudioResult = {
  audioBlob: Blob | null;
  error: Error | null;
};

export default function BookAudioControl(props: {
  segments: StorySegment[];
  disabled?: boolean;
}) {
  const { showAlert } = useAlert();
  const [isHidden, setIsHidden] = useState(false);
  const [isQueueActive, setIsQueueActive] = useState(false);
  const [isPreparingSegment, setIsPreparingSegment] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number | null>(null);
  const [queueTotal, setQueueTotal] = useState(0);
  const [currentQueueSegmentId, setCurrentQueueSegmentId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<AudioPlaybackStatus>({
    activeSegmentId: null,
    state: 'idle',
    currentTime: 0,
    duration: 0,
    errorMessage: null,
  });
  const queueRunIdRef = useRef(0);

  const playableSegments = useMemo(
    () => props.segments.filter(segment => segment.role === 'assistant' && segment.content.trim()),
    [props.segments],
  );

  useEffect(() => {
    return subscribeToAudioPlayback(setPlaybackStatus);
  }, []);

  useEffect(() => {
    return () => {
      queueRunIdRef.current += 1;
      stopAudioPlayback();
    };
  }, []);

  const isCurrentQueueSegment = currentQueueSegmentId != null && playbackStatus.activeSegmentId === currentQueueSegmentId;
  const isQueueLoading = isQueueActive && (isPreparingSegment || (isCurrentQueueSegment && playbackStatus.state === 'loading'));
  const isQueuePaused = isQueueActive && isCurrentQueueSegment && playbackStatus.state === 'paused';
  const isQueuePlaying = isQueueActive && isCurrentQueueSegment && (playbackStatus.state === 'playing' || playbackStatus.state === 'waiting');
  const canStopQueue = isQueueActive && !props.disabled;
  const canStartQueue = !props.disabled && playableSegments.length > 0;
  const queueProgressLabel = queueTotal > 0
    ? `${(currentQueueIndex ?? 0) + 1}/${queueTotal}`
    : `${playableSegments.length}`;
  const audioTimeLabel = isCurrentQueueSegment
    ? `${formatAudioTime(playbackStatus.currentTime)} / ${formatAudioTime(playbackStatus.duration)}`
    : null;

  const createPrefetchTask = (segment: StorySegment): Promise<PrefetchedAudioResult> => {
    return ensureSegmentAudioBlob(segment.id, segment.content)
      .then((audioBlob) => ({ audioBlob, error: null }))
      .catch((error) => ({
        audioBlob: null,
        error: error instanceof Error ? error : new Error('Failed to generate speech.'),
      }));
  };

  const resetQueueState = () => {
    setIsQueueActive(false);
    setIsPreparingSegment(false);
    setCurrentQueueIndex(null);
    setQueueTotal(0);
    setCurrentQueueSegmentId(null);
  };

  const stopQueue = () => {
    queueRunIdRef.current += 1;
    resetQueueState();
    stopAudioPlayback();
  };

  const waitForSegmentPlayback = (segmentId: string, runId: number) => {
    return new Promise<QueuePlaybackResult>((resolve, reject) => {
      const unsubscribe = subscribeToAudioPlayback((status) => {
        if (queueRunIdRef.current !== runId) {
          unsubscribe();
          resolve('stopped');
          return;
        }

        if (status.activeSegmentId === segmentId && status.state === 'error') {
          unsubscribe();
          reject(new Error(status.errorMessage || 'Audio playback failed.'));
          return;
        }

        if (status.activeSegmentId === segmentId) {
          return;
        }

        if (status.activeSegmentId == null && status.state === 'idle') {
          unsubscribe();
          resolve('completed');
          return;
        }

        if (status.activeSegmentId != null && status.activeSegmentId !== segmentId) {
          unsubscribe();
          resolve('interrupted');
        }
      });
    });
  };

  const startQueuePlayback = async (startIndex = 0) => {
    if (props.disabled) {
      return;
    }

    if (playableSegments.length === 0) {
      showAlert('There are no assistant segments with audio to play.', 'warning');
      return;
    }

    const runId = queueRunIdRef.current + 1;
    queueRunIdRef.current = runId;
    setIsQueueActive(true);
    setQueueTotal(playableSegments.length);

    try {
      let prefetchedAudioTask: Promise<PrefetchedAudioResult> | null = null;

      for (let index = startIndex; index < playableSegments.length; index += 1) {
        if (queueRunIdRef.current !== runId) {
          return;
        }

        const segment = playableSegments[index];
        setCurrentQueueIndex(index);
        setCurrentQueueSegmentId(segment.id);
        setIsPreparingSegment(true);

        const currentTask = prefetchedAudioTask ?? createPrefetchTask(segment);
        const { audioBlob, error } = await currentTask;

        if (queueRunIdRef.current !== runId) {
          return;
        }

        if (error || !audioBlob) {
          throw error || new Error('Failed to generate speech.');
        }

        setIsPreparingSegment(false);
        await playAudioBlob(segment.id, audioBlob);

        const nextSegment = playableSegments[index + 1];
        prefetchedAudioTask = nextSegment
          ? createPrefetchTask(nextSegment)
          : null;

        const result = await waitForSegmentPlayback(segment.id, runId);

        if (result !== 'completed') {
          return;
        }
      }
    } catch (error) {
      console.error('Failed during book audio playback:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to play book audio.');
    } finally {
      if (queueRunIdRef.current === runId) {
        resetQueueState();
      }
    }
  };

  const jumpToSegment = async (targetIndex: number) => {
    if (props.disabled || targetIndex < 0 || targetIndex >= playableSegments.length) {
      return;
    }

    stopQueue();
    await startQueuePlayback(targetIndex);
  };

  const handleMainAction = async () => {
    if (props.disabled || isQueueLoading) {
      return;
    }

    try {
      if (isQueuePlaying) {
        pauseAudioPlayback(currentQueueSegmentId ?? undefined);
        return;
      }

      if (isQueuePaused) {
        await resumeAudioPlayback(currentQueueSegmentId ?? undefined);
        return;
      }

      await startQueuePlayback();
    } catch (error) {
      console.error('Failed to control book audio playback:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to control book audio playback.');
    }
  };

  if (isHidden) {
    return (
      <button
        type="button"
        onClick={() => setIsHidden(false)}
        className="fixed bottom-6 right-6 z-20 h-14 w-14 rounded-xl border border-border bg-card shadow-lg hover:bg-muted transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-6 w-6 text-foreground" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.158 4.134a1 1 0 00-1.09.217L6.586 6.833H4a1 1 0 00-1 1v4.334a1 1 0 001 1h2.586l2.482 2.482A1 1 0 0010.75 15V5a1 1 0 00-.592-.866z" />
          <path d="M13.707 6.293a1 1 0 00-1.414 1.414A3 3 0 0113 10a3 3 0 01-.707 1.293 1 1 0 101.414 1.414A4.969 4.969 0 0015 10a4.969 4.969 0 00-1.293-3.707z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-20 h-80 w-80 rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-sm">
      <div className="flex h-full flex-col p-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>Book Audio</span>
          <button
            type="button"
            onClick={() => setIsHidden(true)}
            className="rounded p-1 hover:bg-muted"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 9a1 1 0 100 2h10a1 1 0 100-2H5z" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMainAction}
              className="bg-muted/70 hover:bg-muted p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canStartQueue || isQueueLoading}
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
            <div className="mb-1 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Assistant Segments
            </div>
            <div className="flex flex-col gap-1">
              {playableSegments.map((segment, index) => {
                const isCurrent = segment.id === currentQueueSegmentId;

                return (
                  <button
                    key={segment.id}
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
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}