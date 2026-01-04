'use client';

import { useParams } from 'next/navigation';
import TemplateForm from '../_components/TemplateForm';

export default function TemplateDetailPage() {
  const params = useParams();
  const templateId = params.id as string;

  return (
    <div className="p-8 max-w-3xl">
      <TemplateForm templateId={templateId} />
    </div>
  );
}
