export type PhoneValidationResult = {
  ok: boolean;
  digits: string;
  formatted: string;
  message?: string;
};

export function normalizePhoneDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatKoreanPhoneNumber(value: unknown) {
  const digits = normalizePhoneDigits(value);

  if (!digits) return "";

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export function isKoreanMobilePhone(value: unknown) {
  const digits = normalizePhoneDigits(value);
  return /^01[016789]\d{7,8}$/.test(digits);
}

export function isKoreanPhoneNumber(value: unknown) {
  const digits = normalizePhoneDigits(value);

  if (isKoreanMobilePhone(digits)) return true;
  if (/^02\d{7,8}$/.test(digits)) return true;
  if (/^0[3-6]\d{8,9}$/.test(digits)) return true;
  if (/^070\d{7,8}$/.test(digits)) return true;

  return false;
}

export function validateKoreanPhoneNumber(
  value: unknown,
  options: { mobileOnly?: boolean; required?: boolean } = {},
): PhoneValidationResult {
  const digits = normalizePhoneDigits(value);
  const formatted = formatKoreanPhoneNumber(digits);

  if (!digits) {
    if (options.required === false) {
      return { ok: true, digits, formatted };
    }

    return {
      ok: false,
      digits,
      formatted,
      message: "전화번호를 입력하세요.",
    };
  }

  const valid = options.mobileOnly
    ? isKoreanMobilePhone(digits)
    : isKoreanPhoneNumber(digits);

  if (!valid) {
    return {
      ok: false,
      digits,
      formatted,
      message: options.mobileOnly
        ? "올바른 휴대전화 번호가 아닙니다."
        : "올바른 전화번호 형식이 아닙니다.",
    };
  }

  return {
    ok: true,
    digits,
    formatted,
  };
}

export function assertValidKoreanPhoneNumber(
  value: unknown,
  options: { mobileOnly?: boolean; required?: boolean } = {},
) {
  const result = validateKoreanPhoneNumber(value, options);

  if (!result.ok) {
    throw new Error(result.message ?? "올바른 전화번호 형식이 아닙니다.");
  }

  return result;
}
