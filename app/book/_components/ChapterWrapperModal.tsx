import { Col, Row } from 'antd';
import { useEffect, useState } from 'react';
import _constant from '@/utils/_constant';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { Chapter, Template, StorySegment } from '@/types';
import _util from '@/utils/_util';
import Modal from '@/components/Modal';
import { useAlert } from '@/components/AlertBox';
import _promptUtil from '@/utils/_promptUtil';
import { BookUIModel } from '@/types/extendedTypes';
import { streamAiRequest, AiStreamError } from '@/lib/aiStreamClient';
import { formatErrorDetail } from '@/lib/errorClient';

export default function ChapterWrapperModal(props: {
  template: Template;
  book: BookUIModel;
  segments: StorySegment[];
  onClose: () => void;
  onSave: (segmentIds: string[], newChapter: Chapter) => Promise<boolean>;
}) {
  const { template, book } = props;
  const [values, setValues] = useState({
    chapterName: '',
    content: '',
    summary: '',
    userInput: '',
    summaryLoading: false,
  });

  const { showAlert } = useAlert();

  async function handleGenerateSummary() {
    setValues(prev => ({
      ...prev,
      summaryLoading: true,
      summary: '',
    }));

    const userMessage = _promptUtil.craftBookPrompt(template.promptBuilder.chapterSummarizer, template, book, null, true);

    try {
      const cleaned = await streamAiRequest(
        {
          systemMessage: null,
          messages: [{ role: 'user', content: userMessage }],
          logContext: { feature: 'Chapter summarizer', bookId: book.bookId, bookName: book.name },
        },
        {
          onChunk: (chunk) => {
            setValues(prev => ({ ...prev, summary: prev.summary + chunk }));
          },
        },
      );
      setValues(prev => ({ ...prev, summary: cleaned, summaryLoading: false }));
    } catch (err) {
      const envelope = err instanceof AiStreamError ? err.envelope : undefined;
      const message = err instanceof Error ? err.message : 'AI request failed';
      showAlert(message, { type: 'error', detail: formatErrorDetail(envelope) });
      setValues(prev => ({ ...prev, summaryLoading: false }));
    }
  }

  useEffect(() => {
    setValues(prev => ({
      ...prev,
      content: props.segments.filter(s => s.role === 'assistant').map(s => s.content).join(_constant.newLine2),
    }));
  }, [props.segments]);

  return (
    <Modal
      title="Wrap-Up Chapter"
      centered
      open={true}
      onOk={async () => {
        if(_util.isNullOrWhitespace(values.chapterName) || _util.isNullOrWhitespace(values.summary)) {
          showAlert('Chapter Name and Chapter Summary cannot be empty.');
          return;
        }

        await props.onSave(
          props.segments.map(s => s.id),
          {
            id: new Date().getTime().toString(),
            title: values.chapterName,
            summary: values.summary,
          }
        );
      }}
      onCancel={() => props.onClose()}
      width={1200}
    >
      <div className=' w-full mb-2'>
        <Input
          className=' w-full'
          placeholder='Chapter Name'
          value={values.chapterName}
          onChange={(e) => setValues(prev => ({
            ...prev,
            chapterName: e.target.value,
          }))}
        />
      </div>
      <Row gutter={8}>
        <Col md={12} sm={24} xs={24}>
          <Textarea
            className="w-full bg-muted text-foreground p-2 rounded-md mb-2"
            value={values.content}
            rows={20}
          />
        </Col>
        <Col md={12} sm={24} xs={24}>
          <Textarea
            disabled={values.summaryLoading}
            className="w-full bg-muted text-foreground p-2 rounded-md mb-2"
            value={values.summary}
            onChange={(e) => setValues(prev => ({ ...prev, summary: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col span={24}>
          <div className='w-full flex space-x-2'>
            <Button
              disabled={values.summaryLoading}
              onClick={handleGenerateSummary}
              className='w-40'
              variant="primary"
            >
              {values.summaryLoading ? 'Loading...' : 'Generate Summary'}
            </Button>
          </div>
        </Col>
      </Row>
    </Modal>
  )
}
