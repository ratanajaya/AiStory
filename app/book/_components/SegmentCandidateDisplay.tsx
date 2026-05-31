import Markdown from 'react-markdown';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Textarea } from '@/components/Textarea';
import { StorySegmentCandidate } from '@/types';

export default function SegmentCandidateDisplay(props: {
  candidate: StorySegmentCandidate;
  onSelectContent: (contentIndex: number) => void;
  onUpdateContent: (contentIndex: number, content: string) => void;
  onTryAgain: () => void;
  onEnhanceClick: (candidate: StorySegmentCandidate, contentIndex: number) => void;
  onAccept: () => void;
  onReject: () => void;
  disabled?: boolean;
}) {
  const selectedContent = props.candidate.contents[props.candidate.selectedContentIndex] ?? '';
  const [editor, setEditor] = useState({
    isEditing: false,
    content: selectedContent,
  });

  useEffect(() => {
    setEditor({
      isEditing: false,
      content: selectedContent,
    });
  }, [props.candidate.id, props.candidate.selectedContentIndex, selectedContent]);

  const handleSave = () => {
    props.onUpdateContent(props.candidate.selectedContentIndex, editor.content);
    setEditor(prev => ({
      ...prev,
      isEditing: false,
    }));
  };

  const handleCancel = () => {
    setEditor({
      isEditing: false,
      content: selectedContent,
    });
  };

  return (
    <div className="mb-4 rounded-md border border-dashed border-primary/50 bg-card p-3">
      <div className="mb-3 flex items-center justify-end gap-3">
        <div className="text-xs text-muted-foreground">
          Version {props.candidate.selectedContentIndex + 1} / {props.candidate.contents.length}
        </div>
      </div>

      {props.candidate.contents.length > 1 && (
        <div className="mb-3 flex items-center justify-center gap-2">
          {props.candidate.contents.map((_, index) => (
            <button
              key={`${props.candidate.id}-${index}`}
              type="button"
              className={`min-w-7 rounded-md border px-2 py-1 text-xs ${index === props.candidate.selectedContentIndex ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-foreground'}`}
              onClick={() => props.onSelectContent(index)}
              disabled={props.disabled || editor.isEditing}
              aria-label={`Select candidate version ${index + 1}`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      {editor.isEditing ? (
        <div className="w-full">
          <Textarea
            style={{ fontSize: 'inherit' }}
            className="w-full bg-muted text-foreground p-2 rounded-md mb-2"
            value={editor.content}
            onChange={(e) => setEditor(prev => ({ ...prev, content: e.target.value }))}
            autoSize={{ minRows: 4 }}
          />
          <div className="flex w-full justify-center space-x-2">
            <Button
              variant="primary"
              size="small"
              className="w-24"
              onClick={handleSave}
              disabled={props.disabled}
            >
              Save
            </Button>
            <Button
              variant="outline"
              size="small"
              className="w-24"
              onClick={handleCancel}
              disabled={props.disabled}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative min-h-24 rounded-md bg-background px-1 py-2">
            <div className="absolute bottom-1 right-1 flex gap-2">
              <button
                type="button"
                onClick={() => setEditor({
                  isEditing: true,
                  content: selectedContent,
                })}
                className="rounded-md bg-muted/70 p-1 hover:bg-muted"
                disabled={props.disabled}
                aria-label="Edit candidate"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-1.414 1.414L12 4.828l1.586-1.242zm-2.172 2.172L3 14.172V17h2.828l8.414-8.414L11.414 5.758z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => props.onEnhanceClick(props.candidate, props.candidate.selectedContentIndex)}
                className="rounded-md bg-muted/70 p-1 hover:bg-muted"
                disabled={props.disabled}
                aria-label="Enhance candidate"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11.414V15a1 1 0 11-2 0v-1.586l-.707-.707a1 1 0 011.414-1.414L11 12.586zM10 4a6 6 0 100 12A6 6 0 0010 4z" />
                </svg>
              </button>
            </div>

            <Markdown
              components={{
                p: (markdownProps) => <p {...markdownProps} className="mb-2 text-justify" />,
              }}
            >
              {selectedContent}
            </Markdown>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {props.candidate.isLoading ? 'Generating another candidate...' : 'Review this candidate before accepting it.'}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="small"
                onClick={props.onTryAgain}
                disabled={props.disabled}
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                size="small"
                onClick={props.onReject}
                disabled={props.disabled}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={props.onAccept}
                disabled={props.disabled}
              >
                Accept
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}