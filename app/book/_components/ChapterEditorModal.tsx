import { Chapter } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import Modal from '@/components/Modal';

interface ChapterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedChapter: Chapter) => void;
  chapter: Chapter;
}

const titleErrorMessage = 'Please input the title of the chapter';

export default function ChapterEditorModal({ isOpen, onClose, onSave, chapter }: ChapterEditorModalProps) {
  const [title, setTitle] = useState(chapter.title);
  const [summary, setSummary] = useState(chapter.summary);
  const [titleError, setTitleError] = useState<string>();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(chapter.title);
    setSummary(chapter.summary);
    setTitleError(undefined);
  }, [isOpen, chapter]);

  const handleSave = () => {
    if (!title.trim()) {
      setTitleError(titleErrorMessage);
      titleRef.current?.focus();
      return;
    }

    onSave({ ...chapter, title, summary });
    onClose();
  };

  return (
    <Modal
      title="Edit Chapter"
      open={isOpen}
      onOk={handleSave}
      onCancel={onClose}
      okText="Save"
      cancelText="Cancel"
    >
      <FormField htmlFor="chapter-title" label="Title" required error={titleError}>
        <Input
          ref={titleRef}
          id="chapter-title"
          value={title}
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? 'chapter-title-error' : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
            if (event.target.value.trim()) setTitleError(undefined);
          }}
        />
      </FormField>
      <FormField htmlFor="chapter-summary" label="Summary" className="mb-0">
        <Textarea
          id="chapter-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          rows={10}
        />
      </FormField>
    </Modal>
  );
}
