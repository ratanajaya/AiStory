'use client';

import { useEffect, useState, use } from 'react';
import { Book, Chapter, SegmentSummary, StorySegment, Template } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/Button';
import { useAlert } from '@/components/AlertBox';
import _util from '@/utils/_util';
import SegmentDisplay from '../_components/SegmentDisplay';
import ChapterDisplay from '../_components/ChapterDisplay';
import StatusBar, { StatusBarProps } from '../_components/StatusBar';
import useDebugPanel from '../_components/useDebugPanel';
import useInputPanel from '../_components/useInputPanel';
import EnhancerModal from '../_components/EnhancerModal';
import SummarizerModal from '../_components/SummarizerModal';
import ChapterWrapperModal from '../_components/ChapterWrapperModal';
import BookNameEditor from '../_components/BookNameEditor';
import _constant from '@/utils/_constant';
import { BookUIModel } from '@/types/extendedTypes';

interface PageProps {
  params: Promise<{ bookId: string }>;
}

const emptyBookModel: BookUIModel = {
  bookId: '',
  templateId: '',
  name: null,
  storySegments: [],
  segmentSummaries: [],
  chapters: [],
  shouldSave: false,
  version: 0,
}

export default function BookPage({ params }: PageProps) {
  const { bookId } = use(params);
  const [bookUiModel, setBookUiModel] = useState<BookUIModel>(emptyBookModel);
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const { fetcher } = useFetcher();
  const { showAlert } = useAlert();

  //#region UI State
  const [sbp, setSbp] = useState<StatusBarProps>({
    loading: false,
    text: '',
  });

  const [enhancer, setEnhancer] = useState({
    visible: false,
    segment: null as StorySegment | null,
    prevStory: '',
  });

  const [summarizer, setSummarizer] = useState({
    visible: false,
    placeholder: '',
  });

  const [chapterWrapper, setChapterWrapper] = useState({
    visible: false,
    segments: [] as StorySegment[],
  });
  //#endregion
  
  const debugPanel = useDebugPanel({
    defaultSize: 20,
    minSize: 15,
    order: 3,
    book: bookUiModel,
  });

  const { element: inputPanelElement, getUserInput } = useInputPanel({
    inputTag: template?.prompt.inputTag ?? 'Enter your input here...',
  });

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setLoading(true);        
        const data = await fetcher<Book>(`/api/books/${bookId}`, {
          errorMessage: 'Failed to fetch book',
        });
        setBookUiModel({
          ...data,
          shouldSave: false,
        });
        const templateData = await fetcher<any>(`/api/templates/${data.templateId}/merged`, {
          errorMessage: 'Failed to fetch template',
        });
        setTemplate(templateData);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    if (bookId) {
      fetchBook();
    }
  }, [bookId, fetcher]);

  useEffect(() => {
    if(!bookUiModel.shouldSave)
      return;

    const saveBook = async () => {
      try {
        setSbp({
          loading: true,
          text: 'Saving book changes...',
        });

        const updatedBook = await fetcher<Book>(`/api/books/${bookId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...bookUiModel,
            shouldSave: undefined,
          }),
        });
        
        setSbp({
          loading: false,
          text: 'Book saved to database.',
        });
        
        setBookUiModel(prev => ({
          ...prev,
          version: updatedBook.version,
          shouldSave: false,
        }));
      }
      catch (error: any) {
        showAlert(error?.message);
        
        setSbp({
          loading: false,
          text: `Failed to save book`,
        });
        
        // Reset shouldSave to allow retry
        setBookUiModel(prev => ({
          ...prev,
          shouldSave: false,
        }));
      }
    };
    saveBook();
  }, [bookUiModel, bookId, fetcher, showAlert]);

  const gameAction = {
    _applyNarration: async (userSegmentContent: string, idLimitExclusive: string | null) => {
      if(!template) {
        console.error('Template not loaded');
        return;
      }

      setSbp({
        loading: true,
        text: 'Making call to LLM api...',
      });

      const { segmentsWithoutChapter } = _util.splitSegmentsWithChapter(bookUiModel.storySegments);

      // Context for the AI
      let userMessage1 = '';
      userMessage1 += `STORY BACKGROUND:${_constant.newLine2}`;
      userMessage1 += `${template.storyBackground}${_constant.newLine2}`;

      let chapterSoFar = '';
      bookUiModel.chapters.forEach((chapter, i) => {
        chapterSoFar += chapter.title.toUpperCase() + ':' + _constant.newLine;
        chapterSoFar += chapter.summary + _constant.newLine2;

        const isLastChapter = (i === bookUiModel.chapters.length - 1);

        if(isLastChapter) {
          chapterSoFar += `SITUATION AT THE END OF ${chapter.title.toUpperCase()}:${_constant.newLine2}`;
          chapterSoFar += JSON.stringify(chapter.endState, null, 2) + _constant.newLine2;
        }
      });
      userMessage1 += chapterSoFar;
      
      userMessage1 += `STORY SO FAR OF CURRENT CHAPTER:${_constant.newLine2}`;

      const storySoFar = _util.getStorySegmentAsString(segmentsWithoutChapter, bookUiModel.segmentSummaries, idLimitExclusive);
      userMessage1 += `${_util.altString(storySoFar, '[THIS IS THE START OF A NEW CHAPTER]')}${_constant.newLine2}`;

      // Instructions to the AI on how to respond
      let userMessage2 = '';
      userMessage2 += `${template.prompt.narrator}${_constant.newLine2}`;
      
      userMessage2 += userSegmentContent;
  
      setBookUiModel(prev => ({
        ...prev,
        storySegments: [...prev.storySegments, {
          id: new Date().getTime().toString(),
          day: 0, // Legacy, not used
          content: userSegmentContent,
          role: 'user',
        }],
      }));
      
      await new Promise(r => setTimeout(r, 50));
      // Add a placeholder for the streaming response
      const segmentId = new Date().getTime().toString();
      setBookUiModel(prev => ({
        ...prev,
        storySegments: [...prev.storySegments, {
          id: segmentId,
          day: 0, // Legacy, not used
          content: '',
          role: 'assistant',
        }],
      }));
    
      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemMessage: null,
            messages: [
              { role: 'user', content: userMessage1 },
              { role: 'user', content: userMessage2 },
            ],
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get AI response');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const content = decoder.decode(value, { stream: true });

            setBookUiModel(prev => ({
              ...prev,
              storySegments: prev.storySegments.map(msg => 
                msg.id === segmentId 
                  ? { ...msg, content: msg.content+content }
                  : msg
              ),
            }));
          }
        }
  
        // Stream complete
        setSbp({
          loading: false,
          text: 'AI response complete',
        });
  
        setBookUiModel(prev => ({
          ...prev,
          storySegments: prev.storySegments.map(msg => 
            msg.id === segmentId 
              ? { 
                  ...msg,
                  content: _util.cleanupLlmResponse(msg.content)
                }
              : msg
          ),
          shouldSave: true,
        }));
        
      } catch (error) {
        console.error('Error during streaming:', error);
        setSbp({
          loading: false,
          text: 'Error occurred while streaming response',
        });
      }
    },
    narration: async () => {
      const userInput = getUserInput();
      
      const inputSegment = `${_util.conditionalString(userInput.input1, template?.prompt.inputTag + _constant.newLine + userInput.input1)}`;

      await gameAction._applyNarration(inputSegment, null);
    },
    redoNarration: async (segmentId: string) => {
      const segmentIndex = bookUiModel.storySegments.findIndex(seg => seg.id === segmentId);
      const assistantSegment = bookUiModel.storySegments[segmentIndex];

      if(segmentIndex !== bookUiModel.storySegments.length -1 || assistantSegment?.role !== 'assistant' ) {
        console.error('Can only redo narration for the last assistant segment');
        return;
      }

      const prevUserSegment = bookUiModel.storySegments[segmentIndex -1];
      if(!prevUserSegment || prevUserSegment.role !== 'user') {
        showAlert('Previous segment is not a user segment');
        return;
      }
      
      // Remove the last assistant segment
      setBookUiModel(prev => ({
        ...prev,
        storySegments: prev.storySegments.filter(seg => seg.id !== segmentId && seg.id !== prevUserSegment.id),
      }));

      await gameAction._applyNarration(prevUserSegment.content, segmentId);
    },
    summarizeSegments: (segmentIds: string[], newSummary: SegmentSummary) => {
      setBookUiModel(prev => {
        prev.storySegments = prev.storySegments.map(seg =>{
          if(!segmentIds.includes(seg.id))
            return seg;

          return {
            ...seg,
            segmentSummaryId: newSummary.id,
            toSummarize: false,
          }
        });

        prev.segmentSummaries = [
          ...prev.segmentSummaries,
          newSummary,
        ];

        return {
          ...prev,
          shouldSave: true,
        }
      });

      setSummarizer(prev => ({ ...prev, visible: false }) );
    },
    wrapChapter: (segmentIds: string[], newChapter: Chapter) => {
      setBookUiModel(prev => {
        prev.storySegments = prev.storySegments.map(seg =>{
          if(!segmentIds.includes(seg.id))
            return seg;

          return {
            ...seg,
            chapterId: newChapter.id,
          }
        });

        prev.chapters = [
          ...prev.chapters,
          newChapter,
        ];

        return {
          ...prev,
          shouldSave: true,
        }
      });

      setChapterWrapper(prev => ({ ...prev, visible: false }) );
    }
  }

  const uiAction = {
    updateStorySegment: (updatedSegment: StorySegment) => {
      setBookUiModel(prev => ({
        ...prev,
        storySegments: prev.storySegments.map(msg =>
          msg.id === updatedSegment.id ? updatedSegment : msg
        ),
        shouldSave: true,
      }));
    },
    deleteStorySegment: (id: string) => {
      setBookUiModel(prev => ({
        ...prev,
        storySegments: prev.storySegments.filter(msg => msg.id !== id),
        shouldSave: true,
      }));
    },
    openChapterWrapper: (segmentId: string) => {
      const segmentIndex = bookUiModel.storySegments.findIndex(s => s.id === segmentId);

      const chapterSegments = bookUiModel.storySegments.filter((s, index) => !s.chapterId && index <= segmentIndex);

      // if(chapterSegments.length <= 2) {
      //   showAlert('At least 3 segments are required to form a chapter.');
      //   return;
      // }

      setChapterWrapper({
        visible: true,
        segments: chapterSegments,
      });
    },
    updateChapter: (updatedChapter: Chapter) => {
      setBookUiModel(prev => ({
        ...prev,
        chapters: prev.chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c),
        shouldSave: true,
      }));
    }
  }

  if (loading) {
    return <div className="p-8">Loading book...</div>;
  }

  if (_util.isNullOrWhitespace(bookUiModel.bookId)) {
    return <div className="p-8">Book not found</div>;
  }

  const disableAction = loading; 

  return (
    <div className="h-screen p-8">
      <BookNameEditor
        bookId={bookId}
        bookName={bookUiModel.name}
        onNameUpdate={(newName) => {
          setBookUiModel(prev => ({
            ...prev,
            name: newName,
          }));
        }}
        onStatusChange={setSbp}
      />
      <PanelGroup
        direction="horizontal"
        className=' flex-1'
      >
        {/* STORY PANEL */}
        <Panel id='story' defaultSize={55} minSize={20} order={2}
          className=' p-3'
        >
          <div className=' flex flex-col w-full h-full'>
            <PanelGroup 
              direction="vertical"
              className= ' flex-1'
            >
              <Panel defaultSize={75} minSize={15} order={1} className="relative">
                {bookUiModel.storySegments.some(seg => seg.toSummarize) && (
                <div className='absolute top-2 left-1/2 -translate-x-1/2 z-10'>
                  <Button variant='primary'
                    onClick={() => {
                      const assistantSegments = bookUiModel.storySegments.filter(s => s.role === 'assistant');
                      const segmentsToSummarize = assistantSegments.filter(s => s.toSummarize);

                      // Validate that segments to summarize are continuous
                      if (segmentsToSummarize.length > 0) {
                        const firstIndex = assistantSegments.findIndex(s => s.toSummarize);
                        const lastIndex = assistantSegments.map(s => s.toSummarize).lastIndexOf(true);
                        const expectedCount = lastIndex - firstIndex + 1;
                        
                        if (segmentsToSummarize.length !== expectedCount) {
                          showAlert('Segments to summarize must be continuous.');
                          return;
                        }
                      }

                      setSummarizer(prev => ({ ...prev, visible: true }));
                    }}
                  >
                    Summarize
                  </Button>
                </div>
                )}
                <div className=' overflow-y-scroll w-full h-full p-2 rounded-md bg-stone-800 border-2 border-zinc-800'>
                  {(() => {
                    // Separate segments by whether they have a chapterId
                    const { segmentsWithoutChapter, segmentsWithChapter } = _util.splitSegmentsWithChapter(bookUiModel.storySegments);
                    
                    // Group segments by chapterId
                    const chapterGroups = segmentsWithChapter.reduce((acc, seg) => {
                      if (!acc[seg.chapterId!]) {
                        acc[seg.chapterId!] = [];
                      }
                      acc[seg.chapterId!].push(seg);
                      return acc;
                    }, {} as Record<string, StorySegment[]>);

                    return (
                      <>
                        {/* Render chapters */}
                        {Object.entries(chapterGroups).map(([chapterId, segments]) => {
                          const chapter = bookUiModel.chapters.find(c => c.id === chapterId);
                          if (!chapter) return null;
                          
                          return (
                            <ChapterDisplay
                              key={chapterId}
                              chapter={chapter}
                              segments={segments}
                              onChapterUpdate={uiAction.updateChapter}
                            />
                          );
                        })}

                        {/* Render segments without chapterId */}
                        {segmentsWithoutChapter.map((seg, index) => {
                          const segmentSummaryIndex = bookUiModel.segmentSummaries.findIndex(s => s.id === seg.segmentSummaryId);

                          const segmentSummary = segmentSummaryIndex >= 0
                            ? bookUiModel.segmentSummaries[segmentSummaryIndex]
                            : null;
                          
                          return (
                            <SegmentDisplay 
                              key={seg.id}
                              index={index}
                              segment={seg}
                              segmentSummary={segmentSummary}
                              segmentSummaryIndex={segmentSummaryIndex >= 0 ? segmentSummaryIndex : undefined}
                              onUpdateSegment={uiAction.updateStorySegment}
                              onDeleteSegment={uiAction.deleteStorySegment}
                              onEnhanceClick={(chat) => {
                                setEnhancer({
                                  visible: true,
                                  segment: chat,
                                  prevStory: _util.getStorySegmentAsString(segmentsWithoutChapter, bookUiModel.segmentSummaries, chat.id),
                                });
                              }}
                              onWrapChapter={uiAction.openChapterWrapper}
                              onRedoNarration={gameAction.redoNarration}
                              isLastMessage={index === segmentsWithoutChapter.length - 1}
                              disabled={disableAction}
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
                
                {enhancer.visible && enhancer.segment && (
                  <EnhancerModal
                    segment={enhancer.segment}
                    prevStory={enhancer.prevStory}
                    onClose={() => setEnhancer(prev => ({ ...prev, visible: false }))}
                    onSave={(segment) => {
                      setEnhancer(prev => ({ ...prev, visible: false }));
                      uiAction.updateStorySegment(segment);
                    }}
                  />
                )}
                {summarizer.visible && (
                  <SummarizerModal 
                    segments={bookUiModel.storySegments}
                    segmentSummaries={bookUiModel.segmentSummaries}
                    onClose={() => setSummarizer(prev => ({ ...prev, visible: false }))}
                    onSave={gameAction.summarizeSegments}
                  />
                )}
                {template && chapterWrapper.visible && (
                  <ChapterWrapperModal
                    template={template}
                    segments={chapterWrapper.segments}
                    onClose={() => setChapterWrapper(prev => ({ ...prev, visible: false }))}
                    onSave={gameAction.wrapChapter}
                  />
                )}
              </Panel>
              <StatusBar {...sbp} />
              <PanelResizeHandle className=' mt-1 mb-1 h-1 bg-neutral-600' />
              {inputPanelElement}
            </PanelGroup>
            <div className=' h-2'></div>
            <Button
              className=' w-full h-7'
              onClick={gameAction.narration}
              disabled={disableAction}
            >
              SEND
            </Button>
          </div>
        </Panel>
        <PanelResizeHandle className=' w-1 bg-neutral-600' />
        {debugPanel.element}
      </PanelGroup>
    </div>
  );
}
