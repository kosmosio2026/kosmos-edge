import MobileParkingSpacesPage from '@/features/mobile/pages/mobile-parking-spaces-page';

type PageProps = {
  searchParams?: Promise<{
    qrToken?: string | string[];
  }>;
};

function firstParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function Page({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const qrToken = firstParam(params.qrToken) || 'dev-lot-qr';

  return <MobileParkingSpacesPage qrToken={qrToken} />;
}
