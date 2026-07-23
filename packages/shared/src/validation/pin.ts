export type PinValidationResult = {
  ok: boolean;
  normalized: string;
  message?: string;
};

export function normalizePin(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 6);
}

export function validateVisitorPin(value: unknown): PinValidationResult {
  const normalized = normalizePin(value);

  if (!normalized) {
    return {
      ok: false,
      normalized,
      message: "PIN 코드를 입력하세요.",
    };
  }

  if (!/^\d{4,6}$/.test(normalized)) {
    return {
      ok: false,
      normalized,
      message: "PIN 코드는 숫자 4~6자리여야 합니다.",
    };
  }

  return {
    ok: true,
    normalized,
  };
}

export function assertValidVisitorPin(value: unknown) {
  const result = validateVisitorPin(value);

  if (!result.ok) {
    throw new Error(result.message ?? "PIN 코드 형식이 올바르지 않습니다.");
  }

  return result.normalized;
}
