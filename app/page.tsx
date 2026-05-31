import Image from 'next/image';
import TemplateCardGrid from './_components/TemplateCardGrid';

export default function Home() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <Image
          src="/logo.svg"
          alt="AI Story logo"
          width={56}
          height={56}
          priority
        />
        <div>
          <h1 className="text-3xl font-bold text-foreground leading-tight">AI Story</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Template-driven story generation</p>
        </div>
      </div>
      <h2 className="text-xl font-semibold text-secondary mb-4">Your Library</h2>
      <TemplateCardGrid />
    </div>
  );
}
