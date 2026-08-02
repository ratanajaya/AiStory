import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { InputNumber } from '@/components/InputNumber';
import { Textarea } from '@/components/Textarea';
import _constant from '@/utils/_constant';
import { SegmentSummary, StorySegment, Template } from '@/types';
import Modal from '@/components/Modal';
import { useAlert } from '@/components/AlertBox';
import _promptUtil from '@/utils/_promptUtil';
import { streamAiRequest, AiStreamError } from '@/lib/aiStreamClient';
import { formatErrorDetail } from '@/lib/errorClient';

export default function SegmentSummarizerModal(props: {
  template: Template;
  bookId: string;
  bookName: string | null;
  segments: StorySegment[];
  segmentSummaries: SegmentSummary[];
  onClose: () => void;
  onSave: (segmentIds: string[], newSummary: SegmentSummary) => Promise<boolean>;
}) {
  const { template } = props;
  const { showAlert } = useAlert();

  const [values, setValues] = useState({
    content: '',
    llmResponse: '',
    userInput: '',
    isLoading: false,
    paragraphCount: 0,
  });

  async function handleSubmit() {
    setValues(prev => ({
      ...prev,
      isLoading: true,
      llmResponse: '',
    }));

    const segmentToSummarize = props.segments.filter(s => s.toSummarize);
    const contentToSummarize = segmentToSummarize.map(s => s.content).join(_constant.newLine2);

    const userMessage = _promptUtil.replacePromptBuilderString(template.promptBuilder.segmentSummarizer!, {
        segmentContents: contentToSummarize,
        paragraphCount: `${values.paragraphCount}`,
      });

    try {
      const cleaned = await streamAiRequest(
        {
          feature: 'segmentSummarizer',
          systemMessage: template.promptBuilder.segmentSummarizerSystem,
          messages: [{ role: 'user', content: userMessage }],
          logContext: { feature: 'Segment summarizer', bookId: props.bookId, bookName: props.bookName },
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

  useEffect(() => {
    const segmentToSummarizeCount = props.segments.filter(s => s.toSummarize).length;
    setValues(prev => ({
      ...prev,
      content: props.segments.filter(s => s.toSummarize).map(s => s.content).join(_constant.newLine2),
      paragraphCount: segmentToSummarizeCount,
    }));
  }, [props.segments]);

  return (
    <Modal
      title="Summarize segments"
      centered
      open={true}
      onOk={async () => {
        await props.onSave(
          props.segments.filter(s => s.toSummarize).map(s => s.id),
          {
            id: new Date().getTime().toString(),
            content: values.llmResponse,
          }
        );
      }}
      onCancel={() => props.onClose()}
      width={800}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormField label="Paragraph Count">
            <InputNumber
              min={1}
              value={values.paragraphCount}
              onChange={(value) => {
                setValues(prev => ({
                  ...prev,
                  paragraphCount: value,
                }));
              }}
              className="bg-muted text-foreground"
            />
          </FormField>
        </div>
        <div>
          <Textarea
            className="w-full"
            value={values.content}
            rows={20}
            readOnly
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
  )
}
