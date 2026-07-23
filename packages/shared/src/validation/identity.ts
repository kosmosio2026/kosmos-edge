export type EmailValidationResult = {
  ok: boolean;
  normalized: string;
  message?: string;
};

const SIMPLE_EMAIL_PATTERN =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function validateEmail(value: unknown): EmailValidationResult {
  const normalized = normalizeEmail(value);

  if (!normalized) {
    return {
      ok: false,
      normalized,
      message: "이메일 주소를 입력하세요.",
    };
  }

  if (normalized.length > 254) {
    return {
      ok: false,
      normalized,
      message: "이메일 주소가 너무 깁니다.",
    };
  }

  if (!SIMPLE_EMAIL_PATTERN.test(normalized)) {
    return {
      ok: false,
      normalized,
      message: "올바른 이메일 형식이 아닙니다.",
    };
  }

  return {
    ok: true,
    normalized,
  };
}

export function assertValidEmail(value: unknown) {
  const result = validateEmail(value);

  if (!result.ok) {
    throw new Error(result.message ?? "올바른 이메일 형식이 아닙니다.");
  }

  return result.normalized;
}
