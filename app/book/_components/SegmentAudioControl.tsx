import { useEffect, useState } from "react";
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

export default function SegmentAudioControl(props: {
  segmentId: string;
  content: string;
  disabled?: boolean;
  className?: string;
}) {
  const { showAlert } = useAlert();
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<AudioPlaybackStatus>({
    activeSegmentId: null,
    state: 'idle',
    currentTime: 0,
    duration: 0,
    errorMessage: null,
  });

  useEffect(() => {
    return subscribeToAudioPlayback(setPlaybackStatus);
  }, []);

  const isActiveTtsSegment = playbackStatus.activeSegmentId === props.segmentId;
  const isTtsLoading = isActiveTtsSegment && playbackStatus.state === 'loading';
  const isTtsPaused = isActiveTtsSegment && playbackStatus.state === 'paused';
  const isTtsPlaying = isActiveTtsSegment && (playbackStatus.state === 'playing' || playbackStatus.state === 'waiting');
  const canStopTts = isActiveTtsSegment && playbackStatus.state !== 'idle' && !props.disabled;
  const audioTimeLabel = isActiveTtsSegment
    ? `${formatAudioTime(playbackStatus.currentTime)} / ${formatAudioTime(playbackStatus.duration)}`
    : null;

  const fetchAndPlayTts = async () => {
    if (props.disabled || isGeneratingTts) {
      return;
    }

    if (!props.content.trim()) {
      showAlert('This segment has no content to convert.', 'warning');
      return;
    }

    setIsGeneratingTts(true);

    try {
      const audioBlob = await ensureSegmentAudioBlob(props.segmentId, props.content);

      await playAudioBlob(props.segmentId, audioBlob);
    } catch (error) {
      console.error('Failed to play TTS audio:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to generate speech.');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const handleMainTtsAction = async () => {
    if (props.disabled || isGeneratingTts || isTtsLoading) {
      return;
    }

    try {
      if (isTtsPlaying) {
        pauseAudioPlayback(props.segmentId);
        return;
      }

      if (isTtsPaused) {
        await resumeAudioPlayback(props.segmentId);
        return;
      }

      await fetchAndPlayTts();
    } catch (error) {
      console.error('Failed to control TTS playback:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to control audio playback.');
    }
  };

  const handleStopTts = () => {
    stopAudioPlayback(props.segmentId);
  };

  return (
    <div className={props.className ?? 'flex items-center gap-1'}>
      <button
        type="button"
        onClick={handleMainTtsAction}
        className="bg-muted/70 hover:bg-muted p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={props.disabled || isGeneratingTts || isTtsLoading}
      >
        {isGeneratingTts || isTtsLoading ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground animate-spin" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-13a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : isTtsPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 4a1 1 0 00-1 1v10a1 1 0 102 0V5A1 1 0 006 4z" />
            <path d="M14 4a1 1 0 00-1 1v10a1 1 0 102 0V5a1 1 0 00-1-1z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6.5 4.5a1 1 0 011.537-.843l6 4A1 1 0 0114 9.343l-6 4A1 1 0 016.5 12.5v-8z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={handleStopTts}
        className="bg-muted/70 hover:bg-muted p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canStopTts}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H7a1 1 0 01-1-1V6z" />
        </svg>
      </button>
      {audioTimeLabel && (
        <span className="ml-2 min-w-20 text-xs tabular-nums text-muted-foreground">
          {audioTimeLabel}
        </span>
      )}
    </div>
  );
}