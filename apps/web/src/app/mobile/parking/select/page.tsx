import MobileParkingLotPickerPage from '@/features/mobile/pages/mobile-parking-lot-picker-page';
import MobileQrRegisterPage from '@/features/mobile/pages/mobile-qr-register-page';

type PageProps = {
  searchParams?: Promise<{
    qrToken?: string | string[];
    space?: string | string[];
    returnTo?: string | string[];
  }>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const qrToken = firstParam(params.qrToken) || '';
  const initialSpaceCode = firstParam(params.space) || '';
  const returnTo = firstParam(params.returnTo) || '';

  if (!qrToken) {
    return <MobileParkingLotPickerPage returnTo={returnTo} />;
  }

  return (
    <MobileQrRegisterPage
      qrToken={qrToken}
      initialSpaceCode={initialSpaceCode}
    />
  );
}
