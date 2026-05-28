import { Col, Row } from 'antd';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Textarea } from '@/components/Textarea';
import { Checkbox } from '@/components/Checkbox';
import Modal from '@/components/Modal';
import { useAlert } from '@/components/AlertBox';
import { StorySegment, Template } from '@/types';
import { BookUIModel } from '@/types/extendedTypes';
import _promptUtil from '@/utils/_promptUtil';
import { streamAiRequest, AiStreamError } from '@/lib/aiStreamClient';
import { formatErrorDetail } from '@/lib/errorClient';

export default function SegmentEnhancerModal(props: {
  template: Template;
  book: BookUIModel;
  segment: StorySegment;
  onClose: () => void;
  onSave: (segment: StorySegment) => void;
}) {
  const { showAlert } = useAlert();
  const [values, setValues] = useState({
    content: '',
    llmResponse: '',
    userInput: '',
    isLoading: false,
    includePrevChapters: true,
  });

  useEffect(() => {
    setValues(prev => ({
      ...prev,
      content: props.segment.content,
    }));
  }, [props.segment]);

  async function handleSubmit() {
    setValues(prev => ({
      ...prev,
      isLoading: true,
      llmResponse: '',
    }));

    const fullUserPrompt = _promptUtil.craftBookPrompt(
      props.template.promptBuilder.enhancer,
      props.template, props.book,
      null,
      values.includePrevChapters,
      {
        textboxInput: values.userInput.trim(),
      }
    );

    try {
      const cleaned = await streamAiRequest(
        {
          systemMessage: 'Follow the instruction specified after the PROMPT:',
          messages: [{ role: 'user', content: fullUserPrompt }],
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
      onOk={() => props.onSave({
        ...props.segment,
        content: values.content
      })}
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
      <Row gutter={8}>
        <Col md={12} sm={24} xs={24}>
          <Textarea
            className="w-full text-foreground p-2 rounded-md mb-2"
            value={values.content}
            onChange={(e) => setValues(prev => ({ ...prev, content: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col md={12} sm={24} xs={24}>
          <Textarea
            disabled={values.isLoading}
            className="w-full text-foreground p-2 rounded-md mb-2"
            value={values.llmResponse}
            onChange={(e) => setValues(prev => ({ ...prev, llmResponse: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col span={24}>
          <div className='w-full flex space-x-2'>
            <Textarea
              style={{ fontSize: 'inherit' }}
              className="flex-1 text-foreground p-2 rounded-md mb-2"
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
        </Col>
      </Row>
    </Modal>
  )
}
