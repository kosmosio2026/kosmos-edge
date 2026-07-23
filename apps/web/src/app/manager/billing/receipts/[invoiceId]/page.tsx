import { InvoiceDocumentPage } from '@/features/billing/pages/invoice-document-page';

export default async function Page({
  params,
}: {
  params: Promise<{
    invoiceId: string;
  }>;
}) {
  const { invoiceId } = await params;

  return (
    <InvoiceDocumentPage
      area="manager"
      mode="receipt"
      documentId={invoiceId}
    />
  );
}
