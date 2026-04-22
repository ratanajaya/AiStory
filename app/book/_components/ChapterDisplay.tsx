import { useState } from "react";
import SegmentAudioControl from "./SegmentAudioControl";
import Markdown from "react-markdown";
import { Chapter, StorySegment } from "@/types";
import { DownOutlined, RightOutlined, EditOutlined } from '@ant-design/icons';
import ChapterEditorModal from "./ChapterEditorModal";

export default function ChapterDisplay(props: {
  chapter: Chapter;
  segments: StorySegment[];
  onChapterUpdate: (updatedChapter: Chapter) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Only render assistant segments
  const assistantSegments = props.segments.filter(seg => seg.role === 'assistant');

  return (
    <div className="mb-4 border border-border rounded-md bg-background">
      {/* Chapter Header - Collapsible */}
      <div
        className="p-1 pl-2 cursor-pointer hover:bg-muted transition-colors flex items-start gap-2"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <DownOutlined /> : <RightOutlined />}
        </div>
        <div className="flex-1" onClick={() => setIsExpanded(!isExpanded)}>
          <h3 className="text-md text-foreground">
            {props.chapter.title}
          </h3>
        </div>
        {isHovering && (
          <div className="pr-2">
            <EditOutlined
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
            />
          </div>
        )}
      </div>

      {/* Chapter Content - Expandable */}
      {isExpanded && (
        <div className="border-t border-border p-3 bg-card">
          {assistantSegments.map((segment, index) => (
            <div key={segment.id} className="mb-3 last:mb-0">
              <SegmentAudioControl
                segmentId={segment.id}
                content={segment.content}
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
        onSave={(updatedChapter: Chapter) => {
          props.onChapterUpdate(updatedChapter);
          setIsEditing(false);
        }}
      />
    </div>
  );
}
