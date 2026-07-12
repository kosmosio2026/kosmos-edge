import MobileQrRegisterPage from '@/features/mobile/pages/mobile-qr-register-page';

type PageProps = {
  params: Promise<{
    qrToken: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { qrToken } = await params;

  return <MobileQrRegisterPage qrToken={qrToken} />;
}
