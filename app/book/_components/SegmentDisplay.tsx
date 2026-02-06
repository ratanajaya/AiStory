import { Popconfirm, Space, Tooltip } from "antd";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Textarea } from "@/components/Textarea";
import Markdown from "react-markdown";
import { SegmentSummary, StorySegment } from "@/types";

// Generate consistent colors for summary IDs
const getColorForSummaryId = (summaryId: string): string => {
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
  
  // Simple hash function to get consistent color for same ID
  let hash = 0;
  for (let i = 0; i < summaryId.length; i++) {
    hash = summaryId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function SegmentDisplay(props: {
  index: number;
  segment: StorySegment;
  onUpdateSegment: (updatedSegment: StorySegment) => void;
  onDeleteSegment: (id: string) => void;
  onEnhanceClick: (chat: StorySegment) => void;
  onWrapChapter: (segmentId: string) => void;
  onRedoNarration: (segmentId: string) => void;
  isLastMessage?: boolean;
  disabled?: boolean;
  segmentSummary?: SegmentSummary | null;
}) {
  const [editor, setEditor] = useState({
    isEditing: false,
    content: '',
  });

  const handleSave = () => {
    props.onUpdateSegment({
      ...props.segment,
      content: editor.content,
    });
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

  const colorClass = props.segment.segmentSummaryId 
    ? getColorForSummaryId(props.segment.segmentSummaryId)
    : '';

  const segmentWithSummary = props.segment.role === 'assistant' && props.segmentSummary;

  return (
    <div className={` pb-2 relative group`}>
      {!editor.isEditing && (
        <Space className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {
            props.isLastMessage && props.segment.role === 'assistant' && (
              <button
                onClick={() => props.onRedoNarration(props.segment.id)}
                className="bg-gray-700/70 hover:bg-gray-600/80 p-1 rounded-md mr-1"
                disabled={props.disabled}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
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
            className="bg-gray-700/70 hover:bg-gray-600/80 p-1 rounded-md mr-1"
            disabled={props.disabled}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-1.414 1.414L12 4.828l1.586-1.242zm-2.172 2.172L3 14.172V17h2.828l8.414-8.414L11.414 5.758z" />
            </svg>
          </button>
          
          <button
            onClick={() => props.onEnhanceClick(props.segment)}
            className="bg-gray-700/70 hover:bg-gray-600/80 p-1 rounded-md mr-1"
            disabled={props.disabled}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
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
              className="bg-gray-700/70 hover:bg-gray-600/80 p-1 rounded-md"
              disabled={props.disabled}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
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
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
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
          <div className='w-full h-4 flex items-center text-gray-500 text-sm'>
            <div className='flex-grow border-t border-gray-600'></div>
            <span className='mx-2'>{props.index}</span>
            <div className='flex-grow border-t border-gray-600'></div>
          </div>
        </Tooltip>
      ) : (
        <>
          <div className=' w-full text-right'>
            {/* <Space> */}
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
                    });
                  }}
                  disabled={props.segment.segmentSummaryId != null}
                />
              </Tooltip>
          </div>
          <div className={`relative ${segmentWithSummary ? `border-l-4 pl-3 ${colorClass}` : ''}`}>
            <Markdown
              components={{
                p: ({ node, ...props }) => <p {...props} className="mb-2 text-justify" />,
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
                          p: ({ node, ...props }) => <p {...props} className="mb-1 text-sm" />,
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