import { Col, Row } from 'antd';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Textarea } from '@/components/Textarea';
import { Checkbox } from '@/components/Checkbox';
import Modal from '@/components/Modal';
import _constant from '@/utils/_constant';
import { StorySegment } from '@/types';
import _util from '@/utils/_util';

export default function EnhancerModal(props: {
  segment: StorySegment;
  prevStory: string;
  onClose: () => void;
  onSave: (segment: StorySegment) => void;
}) {
  const [values, setValues] = useState({
    content: '',
    llmResponse: '',
    userInput: '',
    isLoading: false,
    includePrevStory: true,
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

    const storyBeforeThisSegment = `${props.prevStory}${_constant.newLine2}`;

    const userInput = `PROMPT:` + _constant.newLine2 + values.userInput.trim();

    const fullUserPrompt = (values.includePrevStory ? (storyBeforeThisSegment + _constant.newLine2) : '') + values.content + _constant.newLine2 + userInput;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemMessage: 'Follow the instruction specified after the PROMPT:',
          messages: [{ role: 'user', content: fullUserPrompt }],
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
        llmResponse: _util.cleanupLlmResponse(prev.llmResponse),
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
        checked={values.includePrevStory}
        onChange={(e) => setValues(prev => ({ ...prev, includePrevStory: e.target.checked }))}
      >
        Include prev story
      </Checkbox>
      <Row gutter={8}>
        <Col md={12} sm={24} xs={24}>
          <Textarea
            className="w-full text-white p-2 rounded-md mb-2"
            value={values.content}
            onChange={(e) => setValues(prev => ({ ...prev, content: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col md={12} sm={24} xs={24}>
          <Textarea
            disabled={values.isLoading}
            className="w-full text-white p-2 rounded-md mb-2"
            value={values.llmResponse}
            onChange={(e) => setValues(prev => ({ ...prev, llmResponse: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col span={24}>
          <div className='w-full flex space-x-2'>
            <Textarea
              style={{ fontSize: 'inherit' }}
              className="flex-1 text-white p-2 rounded-md mb-2"
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
