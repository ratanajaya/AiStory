import { useState } from "react";
import SegmentAudioControl from "./SegmentAudioControl";
import Markdown from "react-markdown";
import { Chapter, StorySegment } from "@/types";
import ChapterEditorModal from "./ChapterEditorModal";

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    aria-hidden="true"
    className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path fillRule="evenodd" d="M7.21 4.29a1 1 0 011.42 0l5 5a1 1 0 010 1.42l-5 5a1 1 0 01-1.42-1.42L11.5 10 7.21 5.71a1 1 0 010-1.42z" clipRule="evenodd" />
  </svg>
);

const EditIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.59 3.59a2 2 0 012.82 2.82l-1.41 1.42-2.83-2.83 1.42-1.41zM10.76 6.41L3 14.17V17h2.83l7.76-7.76-2.83-2.83z" />
  </svg>
);

export default function ChapterDisplay(props: {
  chapter: Chapter;
  segments: StorySegment[];
  bookId: string;
  bookName: string | null;
  onChapterUpdate: (updatedChapter: Chapter) => Promise<boolean>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Only render assistant segments
  const assistantSegments = props.segments.filter(seg => seg.role === 'assistant');

  return (
    <div className="group mb-4 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      {/* Chapter Header - Collapsible */}
      <div className="flex items-center transition-colors hover:bg-muted">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <ChevronIcon expanded={isExpanded} />
          <h3 className="truncate text-sm font-medium text-foreground">
            {props.chapter.title}
          </h3>
        </button>
        <button
          type="button"
          className="mr-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-elevated hover:text-foreground focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          onClick={() => setIsEditing(true)}
          aria-label={`Edit chapter ${props.chapter.title}`}
        >
          <EditIcon />
        </button>
      </div>

      {/* Chapter Content - Expandable */}
      {isExpanded && (
        <div className="border-t border-border p-3 bg-card">
          {assistantSegments.map((segment, index) => (
            <div key={segment.id} className="mb-3 last:mb-0">
              <SegmentAudioControl
                segmentId={segment.id}
                content={segment.content}
                bookId={props.bookId}
                bookName={props.bookName}
                className="mb-2 flex items-center gap-1"
              />
              <div className="text-foreground">
                <Markdown
                  components={{
                    p: (markdownProps) => <p {...markdownProps} className="mb-2 text-justify" />,
                  }}
                >
                  {segment.content}
                </Markdown>
              </div>
              {index < assistantSegments.length - 1 && (
                <div className="my-3 border-t border-border"></div>
              )}
            </div>
          ))}
        </div>
      )}

      <ChapterEditorModal
        chapter={props.chapter}
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        onSave={async (updatedChapter: Chapter) => {
          if (await props.onChapterUpdate(updatedChapter)) {
            setIsEditing(false);
          }
        }}
      />
    </div>
  );
}
