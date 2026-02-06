import { Col, message, Modal, Row } from 'antd';
import { useEffect, useState } from 'react';
import _constant from '@/utils/_constant';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { Chapter, Template, StorySegment } from '@/types';
import _util from '@/utils/_util';

export default function ChapterWrapperModal(props: {
  template: Template;
  segments: StorySegment[];
  onClose: () => void;
  onSave: (segmentIds: string[], newChapter: Chapter) => void;
}) {
  const [values, setValues] = useState({
    chapterName: '',
    content: '',
    summary: '',
    userInput: '',
    endStateString: '',
    summaryLoading: false,
    endStateLoading: false,
  });

  async function handleGenerateSummary() {
    setValues(prev => ({
      ...prev,
      summaryLoading: true,
      summary: '',
    }));

    let userMessage1 = '';
    userMessage1 += `STORY TO SUMMARIZE:${_constant.newLine}`;
    const storySoFar = _util.getStorySegmentAsString(props.segments, [], null);
    userMessage1 += storySoFar;
    
    // Instructions to the AI on how to respond
    let userMessage2 = props.template.prompt.summarizer;

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
          setValues(prev => ({
            ...prev,
            summary: prev.summary + content,
          }));
        }
      }

      setValues(prev => ({
        ...prev,
        summary: _util.cleanupLlmResponse(prev.summary),
        summaryLoading: false,
      }));
    } catch (error) {
      console.error('Error during streaming:', error);
      setValues(prev => ({
        ...prev,
        summaryLoading: false,
        summary: prev.summary + _constant.newLine2 + 'Error: ' + error,
      }));
    }
  }

  async function handleEndState() {
    setValues(prev => ({
      ...prev,
      endStateLoading: true,
      endStateString: '',
    }));

    let userMessage1 = '';
    userMessage1 += `STORY TO SUMMARIZE:${_constant.newLine}`;
    const storySoFar = _util.getStorySegmentAsString(props.segments, [], null);
    userMessage1 += storySoFar;
    
    //Instructions to the AI on how to respond
    let userMessage2 = props.template.prompt.summarizerEndState;

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
          setValues(prev => ({
            ...prev,
            endStateString: prev.endStateString + content,
          }));
        }
      }

      setValues(prev => ({
        ...prev,
        endStateString: _util.cleanupLlmResponse(prev.endStateString),
        endStateLoading: false,
      }));
    } catch (error) {
      console.error('Error during streaming:', error);
      setValues(prev => ({
        ...prev,
        endStateLoading: false,
        endStateString: prev.endStateString + _constant.newLine2 + 'Error: ' + error,
      }));
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
      onOk={() => {
        if(_util.isNullOrWhitespace(values.chapterName) || _util.isNullOrWhitespace(values.summary) || _util.isNullOrWhitespace(values.endStateString)) {
          message.error('Chapter Name, Chapter Summary, and End State cannot be empty.');
          return;
        }

        let endStateObj = null;
        try{
          endStateObj = JSON.parse(values.endStateString);
        } catch (e) {
          message.error('End State is not a valid JSON object. '+ JSON.stringify(e));
          return;
        }

        console.log('End State Object:', endStateObj);

        props.onSave(
          props.segments.map(s => s.id),
          {
            id: new Date().getTime().toString(),
            title: values.chapterName,
            summary: values.summary,
            endState: endStateObj,
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
        <Col md={9} sm={24} xs={24}>
          <Textarea
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
            value={values.content}
            rows={20}
          />
        </Col>
        <Col md={9} sm={24} xs={24}>
          <Textarea
            disabled={values.summaryLoading}
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
            value={values.summary}
            onChange={(e) => setValues(prev => ({ ...prev, summary: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col md={6} sm={24} xs={24}>
          <Textarea
            disabled={values.endStateLoading}
            className="w-full bg-gray-700 text-white p-2 rounded-md mb-2"
            value={values.endStateString}
            onChange={(e) => setValues(prev => ({ ...prev, endStateString: e.target.value }))}
            rows={20}
          />
        </Col>
        <Col span={24}>
          <div className='w-full flex space-x-2'>
            <Button
              disabled={values.summaryLoading}
              onClick={handleGenerateSummary}
              className='w-36'
              variant="primary"
            >
              {values.summaryLoading ? 'Loading...' : 'Generate Summary'}
            </Button>
            <Button
              disabled={values.endStateLoading}
              onClick={handleEndState}
              className='w-36'
              variant="primary"
            >
              {values.endStateLoading ? 'Loading...' : 'Generate End State'}
            </Button>
          </div>
        </Col>
      </Row>
    </Modal>
  )
}
