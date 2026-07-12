import AuthorityRegistrationDetailPage from '@/features/registration-review/pages/authority-registration-detail-page';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return <AuthorityRegistrationDetailPage role="admin" id={id} />;
}
