import { Button, Col, Input, Modal, Row } from 'antd';
import { useEffect, useState } from 'react'
//import { getDynamicAiEndpoint } from 'services/aiEndpointDynamic';
import _constant from '@/utils/_constant';
import { SegmentSummary, StorySegment } from '@/types';

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
  });

  async function handleSubmit() {
    setValues(prev => ({
      ...prev,
      isLoading: true,
      llmResponse: '',
    }));

    const segmentToSummarize = props.segments.filter(s => s.toSummarize);
    
    const segmentToSummarizeCount = props.segments.filter(s => s.toSummarize).length;

    const systemPrompt = `Your task is to write a short version of the story that captures the key points and essence of the content. The short version should maintain the same POV. The short version should be ${segmentToSummarizeCount} paragraphs long.`;

    const contentToSummarize = segmentToSummarize.map(s => s.content).join(_constant.newLine2);

    // try {
    //   const aiEndpoint = getDynamicAiEndpoint();
    //   await aiEndpoint.chatStream(systemPrompt, contentToSummarize, (content) => {
    //     setValues(prev => ({
    //       ...prev,
    //       llmResponse: prev.llmResponse + content,
    //     }));
    //   });

    //   setValues(prev => ({
    //     ...prev,
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

  useEffect(() => {
    setValues(prev => ({
      ...prev,
      content: props.segments.filter(s => s.toSummarize).map(s => s.content).join(_constant.newLine2),
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
        <Col md={12} sm={24} xs={24}>
          <Input.TextArea
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
            value={values.content}
            //onChange={(e) => setValues(prev => ({ ...prev, content: e.target.value }))}
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
            {/* <Input.TextArea
              style={{ fontSize: 'inherit' }}
              className=" flex-1 bg-gray-700 text-white p-2 rounded-md mb-2"
              value={values.userInput}
              onChange={(e) => setValues(prev => ({ ...prev, userInput: e.target.value }))}
              autoSize={{ minRows: 6 }}
            /> */}
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
