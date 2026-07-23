export type NormalizedAddress = {
  postcode: string;
  address: string;
  detailAddress: string;
  roadAddress?: string;
  jibunAddress?: string;
  sido?: string;
  sigungu?: string;
  bname?: string;
};

export function normalizePostcode(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 5);
}

export function isValidKoreanPostcode(value: unknown) {
  return /^\d{5}$/.test(normalizePostcode(value));
}

export function normalizeAddressInput(input: {
  postcode?: unknown;
  address?: unknown;
  detailAddress?: unknown;
  roadAddress?: unknown;
  jibunAddress?: unknown;
  sido?: unknown;
  sigungu?: unknown;
  bname?: unknown;
}): NormalizedAddress {
  return {
    postcode: normalizePostcode(input.postcode),
    address: String(input.address ?? "").trim(),
    detailAddress: String(input.detailAddress ?? "").trim(),
    roadAddress: String(input.roadAddress ?? "").trim() || undefined,
    jibunAddress: String(input.jibunAddress ?? "").trim() || undefined,
    sido: String(input.sido ?? "").trim() || undefined,
    sigungu: String(input.sigungu ?? "").trim() || undefined,
    bname: String(input.bname ?? "").trim() || undefined,
  };
}

export function validateAddressInput(input: {
  postcode?: unknown;
  address?: unknown;
  detailAddress?: unknown;
}) {
  const normalized = normalizeAddressInput(input);

  if (!isValidKoreanPostcode(normalized.postcode)) {
    return {
      ok: false as const,
      normalized,
      message: "우편번호를 검색해서 선택하세요.",
    };
  }

  if (!normalized.address) {
    return {
      ok: false as const,
      normalized,
      message: "주소를 입력하세요.",
    };
  }

  return {
    ok: true as const,
    normalized,
  };
}
