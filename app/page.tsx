import TemplateCardGrid from './_components/TemplateCardGrid';

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-secondary mb-6">Your Library</h1>
      <TemplateCardGrid />
    </div>
  );
}
