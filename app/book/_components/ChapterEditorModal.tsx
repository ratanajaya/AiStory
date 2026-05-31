import { Form } from 'antd';
import { Chapter } from '@/types';
import { useEffect } from 'react';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import Modal from '@/components/Modal';

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
      });
    }
  }, [isOpen, chapter, form]);

  const handleOk = () => {
    form
      .validateFields()
      .then(values => {
        onSave({
            ...chapter,
            ...values,
          });
          onClose();
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
          rules={[{ required: true, message: 'Please input the title of the chapter' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="summary"
          label="Summary"
        >
          <Textarea rows={10} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
