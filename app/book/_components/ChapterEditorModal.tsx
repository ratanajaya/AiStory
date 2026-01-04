import { Modal, Input, Form } from 'antd';
import { Chapter } from '@/types';
import { useEffect } from 'react';

const { TextArea } = Input;

interface ChapterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedChapter: Chapter) => void;
  chapter: Chapter;
}

export default function ChapterEditorModal({ isOpen, onClose, onSave, chapter }: ChapterEditorModalProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (isOpen && chapter) {
      form.setFieldsValue({
        title: chapter.title,
        summary: chapter.summary,
        endState: chapter.endState ? JSON.stringify(chapter.endState, null, 2) : '',
      });
    }
  }, [isOpen, chapter, form]);

  const handleOk = () => {
    form
      .validateFields()
      .then(values => {
        try {
          const parsedEndState = values.endState ? JSON.parse(values.endState) : null;
          onSave({
            ...chapter,
            ...values,
            endState: parsedEndState,
          });
          onClose();
        } catch (error) {
          form.setFields([
            {
              name: 'endState',
              errors: ['Invalid JSON format.'],
            },
          ]);
        }
      })
      .catch(info => {
        console.log('Validate Failed:', info);
      });
  };

  return (
    <Modal
      title="Edit Chapter"
      open={isOpen}
      onOk={handleOk}
      onCancel={onClose}
      okText="Save"
      cancelText="Cancel"
    >
      <Form form={form} layout="vertical" name="chapter_editor_form">
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: 'Please input the title of the chapter!' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="summary"
          label="Summary"
        >
          <TextArea rows={10} />
        </Form.Item>
        <Form.Item
          name="endState"
          label="End State"
        >
          <TextArea rows={8} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
