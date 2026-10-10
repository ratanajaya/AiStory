import ReleasedBookViewer from '@/app/released-books/ReleasedBookViewer';
export default async function Page({ params }: { params: Promise<{ releaseId: string }> }) {
  const { releaseId } = await params; return <ReleasedBookViewer key={releaseId} releaseId={releaseId} />;
}
