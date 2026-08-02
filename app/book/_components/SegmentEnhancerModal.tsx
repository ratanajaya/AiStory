import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Textarea } from '@/components/Textarea';
import { Checkbox } from '@/components/Checkbox';
import Modal from '@/components/Modal';
import { useAlert } from '@/components/AlertBox';
import { StorySegment, StorySegmentCandidate, Template } from '@/types';
import { BookUIModel } from '@/types/extendedTypes';
import _promptUtil from '@/utils/_promptUtil';
import { streamAiRequest, AiStreamError } from '@/lib/aiStreamClient';
import { formatErrorDetail } from '@/lib/errorClient';

type SegmentEnhancerModalProps = {
  template: Template;
  book: BookUIModel;
  onClose: () => void;
} & ({
  segment: StorySegment;
  candidate?: undefined;
  candidateContentIndex?: never;
  onSave: (segment: StorySegment) => void;
  onSaveCandidate?: never;
} | {
  segment?: undefined;
  candidate: StorySegmentCandidate;
  candidateContentIndex: number;
  onSave?: never;
  onSaveCandidate: (content: string) => void;
});

export default function SegmentEnhancerModal(props: SegmentEnhancerModalProps) {
  const { showAlert } = useAlert();
  const selectedCandidateContent = props.candidate
    ? props.candidate.contents[props.candidateContentIndex] ?? ''
    : '';
  const [values, setValues] = useState({
    content: '',
    llmResponse: '',
    userInput: '',
    isLoading: false,
    includePrevChapters: true,
  });

  useEffect(() => {
    setValues({
      content: props.segment?.content ?? selectedCandidateContent,
      llmResponse: '',
      userInput: '',
      isLoading: false,
      includePrevChapters: true,
    });
  }, [props.segment, selectedCandidateContent]);

  async function handleSubmit() {
    setValues(prev => ({
      ...prev,
      isLoading: true,
      llmResponse: '',
    }));

    const promptBook = props.candidate
      ? {
          ...props.book,
          storySegments: [
            ...props.book.storySegments,
            {
              id: props.candidate.id,
              day: 0,
              role: 'assistant',
              content: values.content,
            },
          ],
        }
      : props.book;

    const fullUserPrompt = _promptUtil.craftBookPrompt(
      props.template.promptBuilder.enhancer,
      props.template, promptBook,
      null,
      values.includePrevChapters,
      {
        textboxInput: values.userInput.trim(),
        selectedSegment: values.content,
      }
    );

    try {
      const cleaned = await streamAiRequest(
        {
          feature: 'enhancer',
          systemMessage: props.template.promptBuilder.enhancerSystem,
          messages: [{ role: 'user', content: fullUserPrompt }],
          logContext: { feature: 'Segment enhancer', bookId: props.book.bookId, bookName: props.book.name },
        },
        {
          onChunk: (chunk) => {
            setValues(prev => ({ ...prev, llmResponse: prev.llmResponse + chunk }));
          },
        },
      );
      setValues(prev => ({ ...prev, llmResponse: cleaned, isLoading: false }));
    } catch (err) {
      const envelope = err instanceof AiStreamError ? err.envelope : undefined;
      const message = err instanceof Error ? err.message : 'AI request failed';
      showAlert(message, { type: 'error', detail: formatErrorDetail(envelope) });
      setValues(prev => ({ ...prev, isLoading: false }));
    }
  }

  return (
    <Modal
      title="Enhance this segment"
      centered
      open={true}
      onOk={() => {
        if (props.candidate) {
          props.onSaveCandidate(values.content);
          return;
        }

        if (props.segment) {
          props.onSave({
            ...props.segment,
            content: values.content,
          });
        }
      }}
      onCancel={() => props.onClose()}
      width={800}
    >
      <Checkbox
        className="mb-2"
        checked={values.includePrevChapters}
        onChange={(e) => setValues(prev => ({ ...prev, includePrevChapters: e.target.checked }))}
      >
        Include prev chapters
      </Checkbox>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <Textarea
            className="w-full"
            value={values.content}
            onChange={(e) => setValues(prev => ({ ...prev, content: e.target.value }))}
            rows={20}
          />
        </div>
        <div>
          <Textarea
            disabled={values.isLoading}
            className="w-full"
            value={values.llmResponse}
            onChange={(e) => setValues(prev => ({ ...prev, llmResponse: e.target.value }))}
            rows={20}
          />
        </div>
        <div className="md:col-span-2">
          <div className='flex w-full gap-2'>
            <Textarea
              style={{ fontSize: 'inherit' }}
              className="flex-1"
              value={values.userInput}
              onChange={(e) => setValues(prev => ({ ...prev, userInput: e.target.value }))}
              rows={6}
            />
            <Button
              disabled={values.isLoading}
              onClick={handleSubmit}
              className='w-24'
              variant="primary"
            >
              {values.isLoading ? 'Loading...' : 'SEND'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
