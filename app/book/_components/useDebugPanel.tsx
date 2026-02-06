import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import _constant from '@/utils/_constant';
import { DebugLog } from '@/types';
import _util from '@/utils/_util';
import { BookUIModel } from '@/types/extendedTypes';

type PanelProps = React.ComponentProps<typeof Panel>;

type StoryDownload = {
  filename: string;
  content: string;
  url: string;
};

type DebugPanelProps = {
  book: BookUIModel;
} & PanelProps;

export default function useDebugPanel(panelProps: DebugPanelProps) {
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [collapseDebugPanel, setCollapseDebugPanel] = useState(false);
  const [storyDownloads, setStoryDownloads] = useState<StoryDownload[]>([]);

  useEffect(() => {
    // Cleanup object URLs on unmount to prevent memory leaks
    return () => {
      storyDownloads.forEach(story => URL.revokeObjectURL(story.url));
    };
  }, [storyDownloads]);

  function addDebugLog(content: string, type?: 'info' | 'warning' | 'error') {
    const id = new Date().getTime().toString();
    const newLog: DebugLog = {
      id: id,
      type: type || 'info',
      content
    };

    setDebugLogs(prev => [...prev, newLog]);

    return id;
  }

  function appendDebugLog(id: string, chunk: string) {
    setDebugLogs(prev => prev.map(log => {
      if (log.id === id) {
        return { ...log, content: log.content + chunk };
      }
      return log;
    }));
  }
  
  const handleExportClick = () => {
    const storyContent = _util.getStorySegmentAsString(panelProps.book.storySegments, [], null, `${_constant.newLine2}---${_constant.newLine2}`, true);
    const filename = `Story-${panelProps.book.bookId}-[${String(panelProps.book.storySegments.length).padStart(2, '0')}].md`;
    const storyData = { filename, content: storyContent };

    const blob = new Blob([storyData.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    setStoryDownloads(prev => [...prev, { ...storyData, url }]);
  };

  const element = (
    <>
      {/* Thin vertical collapse button */}
      <div className="flex items-center h-full">
        <div 
          className='ml-2 mr-1 w-3 h-32 bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center cursor-pointer rounded-sm'
          onClick={() => setCollapseDebugPanel(!collapseDebugPanel)}
        >
          {collapseDebugPanel ? <LeftOutlined className='text-gray-300' /> : <RightOutlined className='text-gray-300' />}
        </div>
      </div>
      {!collapseDebugPanel && (
        <Panel
          id='debug'
          className=' p-3 pl-0 flex flex-col h-full'
          defaultSize={panelProps.defaultSize} minSize={panelProps.minSize} order={panelProps.order}
        >
          <div className=" w-full rounded-md bg-stone-800 border-2 border-zinc-800 mb-2 p-2">
            <button 
              className="text-blue-400 hover:text-blue-300 w-full text-left"
              onClick={handleExportClick}
            >
              Export Story
            </button>
            <div className='flex flex-col gap-1 mt-2'>
              {storyDownloads.map((story, index) => (
                <a
                  key={index}
                  href={story.url}
                  download={story.filename}
                  className="bg-neutral-700 hover:bg-neutral-600 text-gray-200 text-xs px-2 py-1 rounded block w-full text-left"
                >
                  {story.filename}
                </a>
              ))}
            </div>
          </div>

          <div className="flex flex-col w-full flex-1 rounded-md bg-stone-800 border-2 border-zinc-800">
            <div className="w-full font-semibold text-center">
              DEBUG
            </div>
            <PanelGroup 
              direction="vertical"
              className= ' flex-1'
            >
              <Panel defaultSize={50} minSize={15} order={1}>

              </Panel>
              <PanelResizeHandle className=' w-full h-1 bg-neutral-600' />
              <Panel defaultSize={50} minSize={15} order={1}>
                <div className=' w-full h-full overflow-y-auto'>
                  {debugLogs.map((log, index) => (
                    <DebugLogDisplay key={index} log={log} />
                  ))}
                </div>
              </Panel>
            </PanelGroup>
          </div>
        </Panel>
      )}
    </>
  );

  return { element, addDebugLog, appendDebugLog };
}

function DebugLogDisplay({ log }: { log: DebugLog }) {
  return (
    <div className=' p-1 mb-3 border-b border-neutral-500'>
      <Markdown>
        {log.content}
      </Markdown>
    </div>
  )
}
