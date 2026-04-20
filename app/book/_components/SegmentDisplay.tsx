import { Popconfirm, Space, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { useAlert } from "@/components/AlertBox";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Textarea } from "@/components/Textarea";
import { AudioPlaybackStatus, deleteSegmentAudio, getSegmentAudio, pauseAudioPlayback, playAudioBlob, resumeAudioPlayback, saveSegmentAudio, stopAudioPlayback, subscribeToAudioPlayback } from "@/lib/ttsIndexedDb";
import Markdown from "react-markdown";
import { SegmentSummary, StorySegment } from "@/types";

const colors = [
  'border-blue-500',
  'border-green-500',
  'border-purple-500',
  'border-yellow-500',
  'border-pink-500',
  'border-cyan-500',
  'border-orange-500',
  'border-red-500',
];

export default function SegmentDisplay(props: {
  index: number;
  segment: StorySegment;
  onUpdateSegment: (updatedSegment: StorySegment, shouldSave: boolean) => void;
  onDeleteSegment: (id: string) => void;
  onEnhanceClick: (chat: StorySegment) => void;
  onWrapChapter: (segmentId: string) => void;
  onRedoNarration: (segmentId: string) => void;
  isLastMessage?: boolean;
  disabled?: boolean;
  segmentSummary?: SegmentSummary | null;
  segmentSummaryIndex?: number;
}) {
  const { showAlert } = useAlert();
  const [editor, setEditor] = useState({
    isEditing: false,
    content: '',
  });
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<AudioPlaybackStatus>({
    activeSegmentId: null,
    state: 'idle',
  });

  useEffect(() => {
    return subscribeToAudioPlayback(setPlaybackStatus);
  }, []);

  const handleSave = async () => {
    if (editor.content !== props.segment.content) {
      try {
        await deleteSegmentAudio(props.segment.id);
      } catch (error) {
        console.error('Failed to clear cached audio:', error);
      }
    }

    props.onUpdateSegment({
      ...props.segment,
      content: editor.content,
    }, true);
    setEditor(prev => ({
      ...prev,
      isEditing: false,
    }));
  };

  const handleCancel = () => {
    setEditor(prev => ({
      ...prev,
      isEditing: false,
    }));
  };

  const handleWrapChapter = () => {
    setEditor(prev => ({
      ...prev,
      isEditing: false,
    }));
    props.onWrapChapter(props.segment.id);
  };
  
  const colorClass = (props.segmentSummaryIndex !== undefined)
    ? colors[props.segmentSummaryIndex % colors.length]
    : '';

  const segmentWithSummary = props.segment.role === 'assistant' && props.segmentSummary;
  const isActiveTtsSegment = playbackStatus.activeSegmentId === props.segment.id;
  const canToggleTts = isActiveTtsSegment && playbackStatus.state !== 'idle' && !props.disabled;
  const canStopTts = isActiveTtsSegment && playbackStatus.state !== 'idle' && !props.disabled;
  const isTtsPaused = isActiveTtsSegment && playbackStatus.state === 'paused';

  const handleTtsClick = async () => {
    if (props.disabled || isGeneratingTts) {
      return;
    }

    if (!props.segment.content.trim()) {
      showAlert('This segment has no content to convert.', 'warning');
      return;
    }

    setIsGeneratingTts(true);

    try {
      const cachedAudio = await getSegmentAudio(props.segment.id);

      if (cachedAudio) {
        if (cachedAudio.content === props.segment.content) {
          await playAudioBlob(props.segment.id, cachedAudio.audioBlob);
          return;
        }

        await deleteSegmentAudio(props.segment.id);
      }

      const response = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: props.segment.content,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') ?? '';
        let errorMessage = 'Failed to generate speech.';

        if (contentType.includes('application/json')) {
          const errorBody = await response.json().catch(() => null) as { error?: string } | null;
          errorMessage = errorBody?.error || errorMessage;
        } else {
          const errorText = await response.text().catch(() => '');
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const mimeType = response.headers.get('content-type') || 'audio/mpeg';
      const audioBlob = await response.blob();

      await saveSegmentAudio({
        segmentId: props.segment.id,
        content: props.segment.content,
        mimeType,
        audioBlob,
        updatedAt: Date.now(),
      });

      await playAudioBlob(props.segment.id, audioBlob);
    } catch (error) {
      console.error('Failed to play TTS audio:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to generate speech.');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  const handleToggleTtsPlayback = async () => {
    if (!canToggleTts) {
      return;
    }

    try {
      if (isTtsPaused) {
        await resumeAudioPlayback(props.segment.id);
        return;
      }

      pauseAudioPlayback(props.segment.id);
    } catch (error) {
      console.error('Failed to toggle TTS playback:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to control audio playback.');
    }
  };

  const handleStopTts = () => {
    stopAudioPlayback(props.segment.id);
  };

  return (
    <div className={` pb-2 relative group`}>
      {!editor.isEditing && (
        <Space className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {
            props.isLastMessage && props.segment.role === 'assistant' && (
              <button
                onClick={() => props.onRedoNarration(props.segment.id)}
                className="bg-muted/70 hover:bg-muted p-1 rounded-md mr-1"
                disabled={props.disabled}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                </svg>
              </button>
            )
          }
          <button
            onClick={() => setEditor({
              isEditing: true,
              content: props.segment.content,
            })}
            className="bg-muted/70 hover:bg-muted p-1 rounded-md mr-1"
            disabled={props.disabled}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-1.414 1.414L12 4.828l1.586-1.242zm-2.172 2.172L3 14.172V17h2.828l8.414-8.414L11.414 5.758z" />
            </svg>
          </button>
          
          <button
            onClick={() => props.onEnhanceClick(props.segment)}
            className="bg-muted/70 hover:bg-muted p-1 rounded-md mr-1"
            disabled={props.disabled}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11.414V15a1 1 0 11-2 0v-1.586l-.707-.707a1 1 0 011.414-1.414L11 12.586zM10 4a6 6 0 100 12A6 6 0 0010 4z" />
            </svg>
          </button>
          <Popconfirm
            title="Are you sure you want to delete this segment?"
            onConfirm={() => props.onDeleteSegment(props.segment.id)}
            okText="Yes"
            cancelText="No"
          >
            <button
              className="bg-muted/70 hover:bg-muted p-1 rounded-md"
              disabled={props.disabled}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </Popconfirm>
        </Space>
      )}

      {editor.isEditing ? (
        <div className="w-full">
          <Textarea
            style={{ fontSize: 'inherit' }}
            className="w-full bg-muted text-foreground p-2 rounded-md mb-2"
            value={editor.content}
            onChange={(e) => setEditor(prev => ({ ...prev, content: e.target.value }))}
            autoSize={{ minRows: 2 }}
          />
          <div className=" w-full flex space-x-2 justify-center">
            <Button
              variant="danger"
              size='small'
              className=' w-24'
              onClick={handleWrapChapter}
            >
              Wrap Ch
            </Button>
            <Button
              variant="primary"
              size='small'
              className=' w-24'
              onClick={handleSave}
            >
              Save
            </Button>
            <Button
              variant="outline"
              size='small'
              className=' w-24'
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) 
      : props.segment.role !== 'assistant' ? (
        <Tooltip
          title={props.segment.content}
          placement="top"
          styles={{
            root:{
              maxWidth: 500,
            }
          }}
        >
          <div className='w-full h-4 flex items-center text-muted-foreground text-sm'>
            <div className='flex-grow border-t border-border'></div>
            <span className='mx-2'>{props.index}</span>
            <div className='flex-grow border-t border-border'></div>
          </div>
        </Tooltip>
      ) : (
        <>
          {/* Assistant Segment */}
          <div className='w-full flex items-center justify-between mb-1'>
            <div className='flex items-center gap-1'>
              <Tooltip
                title={isGeneratingTts ? 'Generating speech' : 'Play TTS'}
                placement="top"
              >
                <button
                  type="button"
                  onClick={handleTtsClick}
                  className="bg-muted/70 hover:bg-muted p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={props.disabled || isGeneratingTts}
                  aria-label="Play TTS"
                >
                  {isGeneratingTts ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground animate-spin" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-13a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.158 4.134a1 1 0 00-1.09.217L6.586 6.833H4a1 1 0 00-1 1v4.334a1 1 0 001 1h2.586l2.482 2.482A1 1 0 0010.75 15V5a1 1 0 00-.592-.866z" />
                      <path d="M13.707 6.293a1 1 0 00-1.414 1.414A3 3 0 0113 10a3 3 0 01-.707 1.293 1 1 0 101.414 1.414A4.969 4.969 0 0015 10a4.969 4.969 0 00-1.293-3.707z" />
                      <path d="M15.828 4.172a1 1 0 00-1.414 1.414A6 6 0 0115 10a6 6 0 01-.586 4.414 1 1 0 101.414 1.414A7.938 7.938 0 0017 10a7.938 7.938 0 00-1.172-5.828z" />
                    </svg>
                  )}
                </button>
              </Tooltip>
              <Tooltip
                title={isTtsPaused ? 'Resume audio' : 'Pause audio'}
                placement="top"
              >
                <button
                  type="button"
                  onClick={handleToggleTtsPlayback}
                  className="bg-muted/70 hover:bg-muted p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canToggleTts}
                  aria-label={isTtsPaused ? 'Resume audio' : 'Pause audio'}
                >
                  {isTtsPaused ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.5 4.5a1 1 0 011.537-.843l6 4A1 1 0 0114 9.343l-6 4A1 1 0 016.5 12.5v-8z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6 4a1 1 0 00-1 1v10a1 1 0 102 0V5A1 1 0 006 4z" />
                      <path d="M14 4a1 1 0 00-1 1v10a1 1 0 102 0V5a1 1 0 00-1-1z" />
                    </svg>
                  )}
                </button>
              </Tooltip>
              <Tooltip
                title="Stop audio"
                placement="top"
              >
                <button
                  type="button"
                  onClick={handleStopTts}
                  className="bg-muted/70 hover:bg-muted p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!canStopTts}
                  aria-label="Stop audio"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H7a1 1 0 01-1-1V6z" />
                  </svg>
                </button>
              </Tooltip>
            </div>
            <Tooltip
              title="To be summarized"
              placement="top"
            >
              <Checkbox
                checked={props.segment.toSummarize}
                onChange={(e) => {
                  props.onUpdateSegment({
                    ...props.segment,
                    toSummarize: e.target.checked,
                  }, false);
                }}
                disabled={props.segment.segmentSummaryId != null}
              />
            </Tooltip>
          </div>
          <div className={`relative ${segmentWithSummary ? `border-l-4 pl-3 ${colorClass}` : ''}`}>
            <Markdown
              components={{
                p: (markdownProps) => <p {...markdownProps} className="mb-2 text-justify" />,
              }}
            >
              {props.segment.content}
            </Markdown>
            
            {/* Summary indicator - shows on hover */}
            {segmentWithSummary && (
              <div className="absolute left-0 top-0 bottom-0 w-1 group/summary cursor-help">
                <Tooltip
                  title={
                    <div className="max-w-md">
                      <div className="font-semibold mb-2 text-sm">Summary:</div>
                      <Markdown
                        components={{
                          p: (markdownProps) => <p {...markdownProps} className="mb-1 text-sm" />,
                        }}
                      >
                        {props.segmentSummary?.content || ''}
                      </Markdown>
                    </div>
                  }
                  placement="left"
                  overlayStyle={{ maxWidth: '500px' }}
                >
                  <div className="h-full w-full" />
                </Tooltip>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}