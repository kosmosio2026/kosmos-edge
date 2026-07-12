import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    boardId: string;
  }>;
};

export default async function DisplayBoardSettingsRedirect({ params }: PageProps) {
  const { boardId } = await params;
  redirect(`/manager/display/settings?boardId=${boardId}`);
}
