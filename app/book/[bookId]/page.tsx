'use client';

import { useEffect, useState, use } from 'react';
import { Book, Chapter, SegmentSummary, StorySegment, StorySegmentCandidate, Template } from '@/types';
import { useFetcher } from '@/components/FetcherProvider';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/Button';
import { useAlert } from '@/components/AlertBox';
import _util from '@/utils/_util';
import { streamAiRequest, AiStreamError } from '@/lib/aiStreamClient';
import { formatErrorDetail } from '@/lib/errorClient';
import BookAudioControl from '../_components/BookAudioControl';
import SegmentDisplay from '../_components/SegmentDisplay';
import ChapterDisplay from '../_components/ChapterDisplay';
import StatusBar, { StatusBarProps } from '../_components/StatusBar';
import useDebugPanel from '../_components/useDebugPanel';
import useInputPanel from '../_components/useInputPanel';
import SegmentEnhancerModal from '../_components/SegmentEnhancerModal';
import SegmentSummarizerModal from '../_components/SegmentSummarizerModal';
import ChapterWrapperModal from '../_components/ChapterWrapperModal';
import BookNameEditor from '../_components/BookNameEditor';
import _constant from '@/utils/_constant';
import { BookUIModel } from '@/types/extendedTypes';
import _promptUtil from '@/utils/_promptUtil';
import SegmentCandidateDisplay from '@/app/book/_components/SegmentCandidateDisplay';

interface PageProps {
  params: Promise<{ bookId: string }>;
}

const replaceCandidateContent = (contents: string[], contentIndex: number, nextContent: string) => {
  return contents.map((content, index) => index === contentIndex ? nextContent : content);
};

const emptyBookModel: BookUIModel = {
  bookId: '',
  templateId: '',
  name: null,
  storySegments: [],
  segmentSummaries: [],
  chapters: [],
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
  const [segmentCandidate, setSegmentCandidate] = useState<StorySegmentCandidate | null>(null);

  const [enhancer, setEnhancer] = useState({
    visible: false,
    mode: null as 'segment' | 'candidate' | null,
    segmentId: null as string | null,
    candidateContentIndex: 0,
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
    book: bookUiModel,
  });

  const { element: inputPanelElement, getUserInput } = useInputPanel({
    inputTag: _constant.inputTag,
    template,
    book: bookUiModel,
    onStatusChange: setSbp,
  });

  const createSegment = async (segment: StorySegment) => {
    try {
      await fetcher(`/api/books/${bookId}/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment }),
        errorMessage: 'Failed to save segment',
      });
      return true;
    } catch {
      return false;
    }
  };

  const updateSegment = async (segment: StorySegment) => {
    try {
      await fetcher(`/api/books/${bookId}/segments/${segment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(segment),
        errorMessage: 'Failed to update segment',
      });
      return true;
    } catch {
      return false;
    }
  };

  const deleteSegment = async (segmentId: string) => {
    try {
      await fetcher(`/api/books/${bookId}/segments/${segmentId}`, {
        method: 'DELETE',
        errorMessage: 'Failed to delete segment',
      });
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setLoading(true);        
        const data = await fetcher<Book>(`/api/books/${bookId}`, {
          errorMessage: 'Failed to fetch book',
        });
        setBookUiModel({
          ...data,
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

  const bookAction = {
    _streamSegmentCandidate: async (options: {
      promptBook: BookUIModel;
      userSegmentContent: string;
      userSegmentId: string;
      idLimitExclusive: string | null;
      appendToExisting: boolean;
      candidateId?: string;
      contentIndex?: number;
    }) => {
      if(!template) {
        console.error('Template not loaded');
        return;
      }

      setSbp({
        loading: true,
        text: 'Making call to LLM api...',
      });

      const userMessage1 = _promptUtil.craftBookPrompt(
        template.promptBuilder.narration1,
        template,
        options.promptBook,
        options.idLimitExclusive,
        true,
      );

      const userMessage2 = _promptUtil.craftBookPrompt(
        template.promptBuilder.narration2,
        template,
        options.promptBook,
        options.idLimitExclusive,
        true,
        {
          textboxInput: options.userSegmentContent,
        },
      );

      const candidateId = options.candidateId ?? new Date().getTime().toString();
      const contentIndex = options.appendToExisting ? options.contentIndex ?? 0 : 0;

      if (options.appendToExisting) {
        setSegmentCandidate(prev => {
          if (!prev || prev.id !== candidateId) {
            return prev;
          }

          return {
            ...prev,
            contents: [...prev.contents, ''],
            selectedContentIndex: contentIndex,
            isLoading: true,
          };
        });
      } else {
        setSegmentCandidate({
          id: candidateId,
          userSegmentId: options.userSegmentId,
          contents: [''],
          selectedContentIndex: 0,
          isLoading: true,
        });
      }
    
      try {
        const finalContent = await streamAiRequest(
          {
            systemMessage: null,
            messages: [
              { role: 'user', content: userMessage1 },
              { role: 'user', content: userMessage2 },
            ],
          },
          {
            onChunk: (chunk) => {
              setSegmentCandidate(prev => {
                if (!prev || prev.id !== candidateId) {
                  return prev;
                }

                const currentContent = prev.contents[contentIndex] ?? '';

                return {
                  ...prev,
                  contents: replaceCandidateContent(prev.contents, contentIndex, currentContent + chunk),
                };
              });
            },
          },
        );

        setSbp({
          loading: false,
          text: 'AI response complete',
        });

        setSegmentCandidate(prev => {
          if (!prev || prev.id !== candidateId) {
            return prev;
          }

          return {
            ...prev,
            contents: replaceCandidateContent(prev.contents, contentIndex, finalContent),
            selectedContentIndex: contentIndex,
            isLoading: false,
          };
        });

      } catch (err) {
        const envelope = err instanceof AiStreamError ? err.envelope : undefined;
        const message = err instanceof Error ? err.message : 'AI request failed';
        showAlert(message, { type: 'error', detail: formatErrorDetail(envelope) });
        setSbp({
          loading: false,
          text: 'Error occurred while streaming response',
        });

        setSegmentCandidate(prev => {
          if (!prev || prev.id !== candidateId) {
            return prev;
          }

          const currentContent = prev.contents[contentIndex] ?? '';
          if (!_util.isNullOrWhitespace(currentContent)) {
            return {
              ...prev,
              isLoading: false,
              selectedContentIndex: contentIndex,
            };
          }

          const nextContents = prev.contents.filter((_, index) => index !== contentIndex);
          if (nextContents.length === 0) {
            return null;
          }

          return {
            ...prev,
            contents: nextContents,
            selectedContentIndex: Math.min(prev.selectedContentIndex, nextContents.length - 1),
            isLoading: false,
          };
        });
      }
    },
    _applyNarration: async (userSegmentContent: string, idLimitExclusive: string | null) => {
      if(!template) {
        console.error('Template not loaded');
        return;
      }

      const promptBook = bookUiModel;
      const userSegment: StorySegment = {
        id: new Date().getTime().toString(),
        day: 0,
        content: userSegmentContent,
        role: 'user',
      };

      if (!await createSegment(userSegment)) {
        return;
      }

      setBookUiModel(prev => ({
        ...prev,
        storySegments: [...prev.storySegments, userSegment],
      }));

      await bookAction._streamSegmentCandidate({
        promptBook,
        userSegmentContent,
        userSegmentId: userSegment.id,
        idLimitExclusive,
        appendToExisting: false,
      });
    },
    retrySegmentCandidate: async () => {
      if (!segmentCandidate) {
        return;
      }

      const sourceUserSegment = bookUiModel.storySegments.find(seg => seg.id === segmentCandidate.userSegmentId);
      if (!sourceUserSegment || sourceUserSegment.role !== 'user') {
        showAlert('Source user segment not found for this candidate');
        return;
      }

      await bookAction._streamSegmentCandidate({
        promptBook: bookUiModel,
        userSegmentContent: sourceUserSegment.content,
        userSegmentId: sourceUserSegment.id,
        idLimitExclusive: null,
        appendToExisting: true,
        candidateId: segmentCandidate.id,
        contentIndex: segmentCandidate.contents.length,
      });
    },
    acceptSegmentCandidate: async () => {
      if (!segmentCandidate) {
        return;
      }

      const content = segmentCandidate.contents[segmentCandidate.selectedContentIndex] ?? '';
      if (_util.isNullOrWhitespace(content)) {
        showAlert('Candidate response is empty');
        return;
      }

      const assistantSegment: StorySegment = {
        id: new Date().getTime().toString(),
        day: 0,
        content,
        role: 'assistant',
      };

      if (!await createSegment(assistantSegment)) {
        return;
      }

      setBookUiModel(prev => ({
        ...prev,
        storySegments: [...prev.storySegments, assistantSegment],
      }));
      setSegmentCandidate(null);
    },
    rejectSegmentCandidate: () => {
      setSegmentCandidate(null);
    },
    narration: async () => {
      if (segmentCandidate) {
        return;
      }

      const userInput = getUserInput();

      const inputSegment = _util.conditionalString(
        userInput.input1,
        _constant.inputTag + _constant.newLine + userInput.input1
      );

      await bookAction._applyNarration(inputSegment, null);
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
      
      const deleted = await Promise.all([
        deleteSegment(segmentId),
        deleteSegment(prevUserSegment.id),
      ]);

      if (deleted.some(result => !result)) {
        return;
      }

      setBookUiModel(prev => ({
        ...prev,
        storySegments: prev.storySegments.filter(seg => seg.id !== segmentId && seg.id !== prevUserSegment.id),
      }));

      await bookAction._applyNarration(prevUserSegment.content, segmentId);
    },
    summarizeSegments: async (segmentIds: string[], newSummary: SegmentSummary) => {
      try {
        await fetcher(`/api/books/${bookId}/summaries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentIds, summary: newSummary }),
          errorMessage: 'Failed to save segment summary',
        });
      } catch {
        return false;
      }

      setBookUiModel(prev => ({
        ...prev,
        storySegments: prev.storySegments.map(seg => segmentIds.includes(seg.id)
          ? { ...seg, segmentSummaryId: newSummary.id, toSummarize: false }
          : seg),
        segmentSummaries: [...prev.segmentSummaries, newSummary],
      }));
      setSummarizer(prev => ({ ...prev, visible: false }));
      return true;
    },
    wrapChapter: async (segmentIds: string[], newChapter: Chapter) => {
      try {
        await fetcher(`/api/books/${bookId}/chapters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentIds, chapter: newChapter }),
          errorMessage: 'Failed to save chapter',
        });
      } catch {
        return false;
      }

      setBookUiModel(prev => ({
        ...prev,
        storySegments: prev.storySegments.map(seg => segmentIds.includes(seg.id)
          ? { ...seg, chapterId: newChapter.id }
          : seg),
        chapters: [...prev.chapters, newChapter],
      }));
      setChapterWrapper(prev => ({ ...prev, visible: false }));
      return true;
    }
  }

  const uiAction = {
    updateStorySegment: async (updatedSegment: StorySegment) => {
      if (!await updateSegment(updatedSegment)) {
        return false;
      }

      setBookUiModel(prev => ({
        ...prev,
        storySegments: prev.storySegments.map(msg =>
          msg.id === updatedSegment.id ? updatedSegment : msg
        ),
      }));
      return true;
    },
    deleteStorySegment: async (id: string) => {
      if (!await deleteSegment(id)) {
        return false;
      }

      setBookUiModel(prev => ({
        ...prev,
        storySegments: prev.storySegments.filter(msg => msg.id !== id),
      }));
      return true;
    },
    openChapterWrapper: (segmentId: string) => {
      const segmentIndex = bookUiModel.storySegments.findIndex(s => s.id === segmentId);

      const chapterSegments = bookUiModel.storySegments.filter((s, index) => !s.chapterId && index <= segmentIndex);

      setChapterWrapper({
        visible: true,
        segments: chapterSegments,
      });
    },
    updateChapter: async (updatedChapter: Chapter) => {
      try {
        await fetcher(`/api/books/${bookId}/chapters/${updatedChapter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedChapter),
          errorMessage: 'Failed to update chapter',
        });
      } catch {
        return false;
      }

      setBookUiModel(prev => ({
        ...prev,
        chapters: prev.chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c),
      }));
      return true;
    },
    selectCandidateContent: (contentIndex: number) => {
      setSegmentCandidate(prev => {
        if (!prev || contentIndex < 0 || contentIndex >= prev.contents.length) {
          return prev;
        }

        return {
          ...prev,
          selectedContentIndex: contentIndex,
        };
      });
    },
    updateCandidateContent: (contentIndex: number, content: string) => {
      setSegmentCandidate(prev => {
        if (!prev || contentIndex < 0 || contentIndex >= prev.contents.length) {
          return prev;
        }

        return {
          ...prev,
          contents: replaceCandidateContent(prev.contents, contentIndex, content),
          selectedContentIndex: contentIndex,
        };
      });
    },
  };

  const enhancerSegment = enhancer.segmentId
    ? bookUiModel.storySegments.find(segment => segment.id === enhancer.segmentId) ?? null
    : null;

  if (loading) {
    return <div className="p-8">Loading book...</div>;
  }

  if (_util.isNullOrWhitespace(bookUiModel.bookId)) {
    return <div className="p-8">Book not found</div>;
  }

  const disableStoryAction = loading || segmentCandidate !== null;
  const disableCandidateAction = loading || (segmentCandidate?.isLoading ?? false);

  return (
    <div className="h-screen bg-background">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-3 py-4 sm:px-4 sm:py-6">
        <div className='flex-1 min-h-0 pt-1'>
          <div className='h-full px-0 py-2 sm:p-3'>
            <div className='flex h-full w-full flex-col'>
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
                direction="vertical"
                className='flex-1'
              >
                <Panel defaultSize={72} minSize={15} order={1} className="relative">
                  {bookUiModel.storySegments.some(seg => seg.toSummarize) && (
                  <div className='absolute top-2 left-1/2 z-10 -translate-x-1/2'>
                    <Button variant='primary'
                      disabled={disableStoryAction}
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
                  <div className='h-full w-full overflow-y-scroll rounded-md border border-border bg-card p-2'>
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
                                    mode: 'segment',
                                    segmentId: chat.id,
                                    candidateContentIndex: 0,
                                  });
                                }}
                                onWrapChapter={uiAction.openChapterWrapper}
                                onRedoNarration={bookAction.redoNarration}
                                isLastMessage={index === segmentsWithoutChapter.length - 1}
                                disabled={disableStoryAction}
                              />
                            );
                          })}

                          {segmentCandidate && (
                            <SegmentCandidateDisplay
                              candidate={segmentCandidate}
                              onSelectContent={uiAction.selectCandidateContent}
                              onUpdateContent={uiAction.updateCandidateContent}
                              onTryAgain={bookAction.retrySegmentCandidate}
                              onEnhanceClick={(_candidate: StorySegmentCandidate, contentIndex: number) => {
                                setEnhancer({
                                  visible: true,
                                  mode: 'candidate',
                                  segmentId: null,
                                  candidateContentIndex: contentIndex,
                                });
                              }}
                              onAccept={bookAction.acceptSegmentCandidate}
                              onReject={bookAction.rejectSegmentCandidate}
                              disabled={disableCandidateAction}
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                  
                  {template && enhancer.visible && enhancer.mode === 'segment' && enhancerSegment && (
                    <SegmentEnhancerModal
                      template={template}
                      book={bookUiModel}
                      segment={enhancerSegment}
                      onClose={() => setEnhancer({
                        visible: false,
                        mode: null,
                        segmentId: null,
                        candidateContentIndex: 0,
                      })}
                      onSave={(segment) => {
                        setEnhancer({
                          visible: false,
                          mode: null,
                          segmentId: null,
                          candidateContentIndex: 0,
                        });
                        void uiAction.updateStorySegment(segment);
                      }}
                    />
                  )}
                  {template && enhancer.visible && enhancer.mode === 'candidate' && segmentCandidate && (
                    <SegmentEnhancerModal
                      template={template}
                      book={bookUiModel}
                      candidate={segmentCandidate}
                      candidateContentIndex={enhancer.candidateContentIndex}
                      onClose={() => setEnhancer({
                        visible: false,
                        mode: null,
                        segmentId: null,
                        candidateContentIndex: 0,
                      })}
                      onSaveCandidate={(content) => {
                        uiAction.updateCandidateContent(enhancer.candidateContentIndex, content);
                        setEnhancer({
                          visible: false,
                          mode: null,
                          segmentId: null,
                          candidateContentIndex: 0,
                        });
                      }}
                    />
                  )}
                  {template && summarizer.visible && (
                    <SegmentSummarizerModal
                      template={template}
                      segments={bookUiModel.storySegments}
                      segmentSummaries={bookUiModel.segmentSummaries}
                      onClose={() => setSummarizer(prev => ({ ...prev, visible: false }))}
                      onSave={bookAction.summarizeSegments}
                    />
                  )}
                  {template && chapterWrapper.visible && (
                    <ChapterWrapperModal
                      template={template}
                      book={bookUiModel}
                      segments={chapterWrapper.segments}
                      onClose={() => setChapterWrapper(prev => ({ ...prev, visible: false }))}
                      onSave={bookAction.wrapChapter}
                    />
                  )}
                </Panel>
                <StatusBar {...sbp} />
                <PanelResizeHandle className='mt-1 mb-1 h-1 bg-border' />
                {inputPanelElement}
              </PanelGroup>
              <div className='h-2'></div>
              <Button
                className='h-7 w-full'
                onClick={bookAction.narration}
                disabled={disableStoryAction}
              >
                SEND
              </Button>
            </div>
          </div>
        </div>
        <BookAudioControl
          segments={bookUiModel.storySegments}
          chapters={bookUiModel.chapters}
          disabled={loading}
        />
        {debugPanel.element}
      </div>
    </div>
  );
}
