import WatcherEnforcementDetailPage from '@/features/watcher/pages/watcher-enforcement-detail-page';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <WatcherEnforcementDetailPage id={id} />;
}
