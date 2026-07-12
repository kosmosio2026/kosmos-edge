import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    qrToken: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { qrToken } = await params;
  redirect(`/mobile/qr/${qrToken}`);
}
