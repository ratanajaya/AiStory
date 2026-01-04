'use client';

import { useParams } from 'next/navigation';
import TemplateForm from '../_components/TemplateForm';

export default function TemplateDetailPage() {
  const params = useParams();
  const templateId = params.id as string;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <TemplateForm templateId={templateId} />
    </div>
  );
}
