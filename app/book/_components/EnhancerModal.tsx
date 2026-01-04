import { Button, Checkbox, Col, Input, Modal, Row } from 'antd';
import { useEffect, useState } from 'react'
//import { getDynamicAiEndpoint } from 'services/aiEndpointDynamic';
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

    //TODO
    // try {
    //   const aiEndpoint = getDynamicAiEndpoint();
    //   await aiEndpoint.chatStream('Follow the instruction specified after the PROMPT:', fullUserPrompt, (content) => {
    //     setValues(prev => ({
    //       ...prev,
    //       llmResponse: prev.llmResponse + content,
    //     }));
    //   });

    //   setValues(prev => ({
    //     ...prev,
    //     llmResponse: util.cleanupLlmResponse(prev.llmResponse),
    //     isLoading: false,
    //   }));      
    // } catch (error) {
    //   console.error('Error during streaming:', error);
    //   setValues(prev => ({
    //     ...prev,
    //     isLoading: false,
    //     llmResponse: prev.llmResponse + _constant.newLine2 + 'Error: ' + error,
    //   }));
    // }
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
          <Input.TextArea
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
            value={values.content}
            onChange={(e) => setValues(prev => ({ ...prev, content: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col md={12} sm={24} xs={24}>
          <Input.TextArea
            disabled={values.isLoading}
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
            value={values.llmResponse}
            onChange={(e) => setValues(prev => ({ ...prev, llmResponse: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col span={24}>
          <div className='w-full flex space-x-2'>
            <Input.TextArea
              style={{ fontSize: 'inherit' }}
              className=" flex-1 bg-gray-700 text-white p-2 rounded-md mb-2"
              value={values.userInput}
              onChange={(e) => setValues(prev => ({ ...prev, userInput: e.target.value }))}
              autoSize={{ minRows: 6 }}
            />
            <Button
              loading={values.isLoading}
              onClick={handleSubmit}
              className='w-24'
              type="primary"
            >
              SEND
            </Button>
          </div>
        </Col>
      </Row>
    </Modal>
  )
}
