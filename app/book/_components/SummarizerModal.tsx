import { Col, Row } from 'antd';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { InputNumber } from '@/components/InputNumber';
import { Textarea } from '@/components/Textarea';
import _constant from '@/utils/_constant';
import { SegmentSummary, StorySegment } from '@/types';
import Modal from '@/components/Modal';

export default function SummarizerModal(props: {
  segments: StorySegment[];
  segmentSummaries: SegmentSummary[];
  onClose: () => void;
  onSave: (segmentIds: string[], newSummary: SegmentSummary) => void;
}) {
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

    const systemPrompt = `Your task is to write a short version of the story that captures the key points and essence of the content. The short version should maintain the same narration POV, wether it's first person, third person, or second person. The short version should be ${values.paragraphCount} paragraphs long.`;

    const contentToSummarize = segmentToSummarize.map(s => s.content).join(_constant.newLine2);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemMessage: systemPrompt,
          messages: [{ role: 'user', content: contentToSummarize }],
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
          setValues(prev => ({
            ...prev,
            llmResponse: prev.llmResponse + content,
          }));
        }
      }

      setValues(prev => ({
        ...prev,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error during streaming:', error);
      setValues(prev => ({
        ...prev,
        isLoading: false,
        llmResponse: prev.llmResponse + _constant.newLine2 + 'Error: ' + error,
      }));
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
      onOk={() => props.onSave(
        props.segments.filter(s => s.toSummarize).map(s => s.id),
        {
          id: new Date().getTime().toString(),
          content: values.llmResponse,
        }
      )}
      onCancel={() => props.onClose()}
      width={800}
    >
      <Row gutter={8}>
        <Col span={24}>
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
              className="bg-gray-700 text-white"
            />
          </FormField>
        </Col>
        <Col md={12} sm={24} xs={24}>
          <Textarea
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
            value={values.content}
            rows={20}
          />
        </Col>
        <Col md={12} sm={24} xs={24}>
          <Textarea
            disabled={values.isLoading}
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
            value={values.llmResponse}
            onChange={(e) => setValues(prev => ({ ...prev, llmResponse: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col span={24}>
          <div className='w-full flex space-x-2'>
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
