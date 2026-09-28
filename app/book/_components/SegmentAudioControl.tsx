import { useBookAudio, useAudioStatus } from '@/app/book/_components/BookAudioProvider';
import { formatAudioTime } from '@/lib/ttsAudioClient';

export default function SegmentAudioControl(props: {
  segmentId: string; content: string; bookId: string; bookName: string | null; disabled?: boolean; className?: string;
}) {
  const { manager, playback } = useBookAudio();
  const playbackStatus = useAudioStatus();
  const active = (playback.part?.segmentId ?? playback.targetSegmentId) === props.segmentId;
  const isGeneratingTts = active && playback.state === 'loading';
  const isTtsLoading = isGeneratingTts;
  const isTtsPlaying = active && playback.state === 'playing';
  const canStopTts = active && !['idle', 'error'].includes(playback.state) && !props.disabled;
  const part = active ? playback.part : null;
  const audioTimeLabel = part ? `Part ${part.partIndex + 1}/${part.partCount} · ${
    playbackStatus.chunkKey === part.key ? `${formatAudioTime(playbackStatus.currentTime)} / ${formatAudioTime(playbackStatus.duration)}` : 'Preparing'
  }` : null;
  const handleMainTtsAction = () => {
    if (props.disabled) return;
    if (isTtsPlaying || isTtsLoading) manager.pause();
    else if (active && playback.state === 'paused') void manager.resume();
    else {
      window.dispatchEvent(new Event('aistory:audio-interrupt'));
      void manager.play([{ id: props.segmentId, content: props.content }], 'segment');
    }
  };
  const handleStopTts = () => manager.stop();

  return (
    <div className={props.className ?? 'flex items-center gap-1'}>
      <button
        type="button"
        onClick={handleMainTtsAction}
        aria-label={isTtsPlaying || isTtsLoading ? 'Pause segment audio' : 'Play segment audio'}
        className="bg-muted/70 hover:bg-muted p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={props.disabled}
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
        aria-label="Stop segment audio"
        className="bg-muted/70 hover:bg-muted p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!canStopTts}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H7a1 1 0 01-1-1V6z" />
        </svg>
      </button>
      {active && playback.error && <span role="alert" className="text-xs text-red-400">{playback.error}</span>}
      {audioTimeLabel && (
        <span className="ml-2 min-w-20 text-xs tabular-nums text-muted-foreground">
          {audioTimeLabel}
        </span>
      )}
    </div>
  );
}
