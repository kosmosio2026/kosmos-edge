export type FeeTaxTypeValue = 'VAT_INCLUDED' | 'TAX_EXEMPT';

export type TaxBreakdown = {
  taxType: FeeTaxTypeValue;
  supplyAmount: number;
  vatAmount: number;
  taxExemptAmount: number;
};

export function resolveFeeTaxType(taxType?: string | null): FeeTaxTypeValue {
  return taxType === 'TAX_EXEMPT' ? 'TAX_EXEMPT' : 'VAT_INCLUDED';
}

export function calculateTaxBreakdown(
  totalAmount: number | string | null | undefined,
  taxType?: string | null,
): TaxBreakdown {
  const total = Math.max(0, Math.round(Number(totalAmount ?? 0)));
  const resolvedTaxType = resolveFeeTaxType(taxType);

  if (resolvedTaxType === 'TAX_EXEMPT') {
    return {
      taxType: 'TAX_EXEMPT',
      supplyAmount: total,
      vatAmount: 0,
      taxExemptAmount: total,
    };
  }

  const supplyAmount = Math.round((total * 10) / 11);

  return {
    taxType: 'VAT_INCLUDED',
    supplyAmount,
    vatAmount: total - supplyAmount,
    taxExemptAmount: 0,
  };
}
