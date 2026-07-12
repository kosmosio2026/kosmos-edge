import { SystemStatusPage } from '@/components/admin/system-status-page';
import { getSystemStatusPageData } from '@/lib/admin-server-data';

export default async function SystemStatusRoutePage() {
  const data = await getSystemStatusPageData();

  const pageData = data as typeof data & {
    dependencies?: unknown[];
    displayHeartbeats?: unknown[];
  };

  return (
    <SystemStatusPage
      services={pageData.services}
      certificates={pageData.certificates}
      dependencies={pageData.dependencies ?? []}
      displayHeartbeats={pageData.displayHeartbeats ?? []}
    />
  );
}