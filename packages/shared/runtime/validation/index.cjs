function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function validateEmail(value) {
  const normalized = normalizeEmail(value);
  const pattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

  if (!normalized) return { ok: false, normalized, message: "이메일 주소를 입력하세요." };
  if (normalized.length > 254) return { ok: false, normalized, message: "이메일 주소가 너무 깁니다." };
  if (!pattern.test(normalized)) return { ok: false, normalized, message: "올바른 이메일 형식이 아닙니다." };

  return { ok: true, normalized };
}

function normalizePhoneDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatKoreanPhoneNumber(value) {
  const digits = normalizePhoneDigits(value);
  if (!digits) return "";

  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function normalizePin(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 6);
}

function validateVisitorPin(value) {
  const normalized = normalizePin(value);

  if (!normalized) return { ok: false, normalized, message: "PIN 코드를 입력하세요." };
  if (!/^\d{4,6}$/.test(normalized)) {
    return { ok: false, normalized, message: "PIN 코드는 숫자 4~6자리여야 합니다." };
  }

  return { ok: true, normalized };
}

function validatePassword(value) {
  const password = String(value ?? "");
  const failedRules = [];
  const messages = [];

  if (password.length < 8) {
    failedRules.push("MIN_LENGTH");
    messages.push("비밀번호는 8자 이상이어야 합니다.");
  }
  if (!/[A-Z]/.test(password)) {
    failedRules.push("UPPERCASE");
  }
  if (!/[a-z]/.test(password)) {
    failedRules.push("LOWERCASE");
    messages.push("영문 소문자를 포함해야 합니다.");
  }
  if (!/[A-Za-z]/.test(password)) {
    failedRules.push("LETTER");
    messages.push("영문자를 포함해야 합니다.");
  }
  if (!/\d/.test(password)) {
    failedRules.push("NUMBER");
    messages.push("숫자를 포함해야 합니다.");
  }
  if (!/[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    failedRules.push("SPECIAL");
  }
  if (/\s/.test(password)) {
    failedRules.push("NO_SPACE");
    messages.push("공백은 사용할 수 없습니다.");
  }

  const ok = failedRules.length === 0;
  return { ok, valid: ok, failedRules, messages };
}

module.exports = {
  normalizeEmail,
  validateEmail,
  normalizePhoneDigits,
  formatKoreanPhoneNumber,
  normalizePin,
  validateVisitorPin,
  validatePassword
};

// KOSMOS runtime pin validation parity override
function normalizePinParity(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

function validateVisitorPinParity(value) {
  const normalized = normalizePinParity(value);

  if (!normalized) {
    return {
      ok: false,
      normalized,
      message: 'PIN 코드를 입력하세요.',
    };
  }

  if (!/^\d{4,6}$/.test(normalized)) {
    return {
      ok: false,
      normalized,
      message: 'PIN 코드는 숫자 4~6자리여야 합니다.',
    };
  }

  return {
    ok: true,
    normalized,
  };
}

function assertValidVisitorPinParity(value) {
  const result = validateVisitorPinParity(value);

  if (!result.ok) {
    throw new Error(result.message ?? 'PIN 코드 형식이 올바르지 않습니다.');
  }

  return result.normalized;
}

module.exports.normalizePin = normalizePinParity;
module.exports.validateVisitorPin = validateVisitorPinParity;
module.exports.assertValidVisitorPin = assertValidVisitorPinParity;


// KOSMOS runtime phone validation parity override
function normalizePhoneDigitsParity(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function formatKoreanPhoneNumberParity(value) {
  const digits = normalizePhoneDigitsParity(value);

  if (!digits) return '';

  if (digits.startsWith('02')) {
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

function isKoreanMobilePhoneParity(value) {
  const digits = normalizePhoneDigitsParity(value);
  return /^01[016789]\d{7,8}$/.test(digits);
}

function isKoreanPhoneNumberParity(value) {
  const digits = normalizePhoneDigitsParity(value);

  if (isKoreanMobilePhoneParity(digits)) return true;
  if (/^02\d{7,8}$/.test(digits)) return true;
  if (/^0[3-6]\d{8,9}$/.test(digits)) return true;
  if (/^070\d{7,8}$/.test(digits)) return true;

  return false;
}

function validateKoreanPhoneNumberParity(value, options = {}) {
  const digits = normalizePhoneDigitsParity(value);
  const formatted = formatKoreanPhoneNumberParity(digits);

  if (!digits) {
    if (options.required === false) {
      return { ok: true, digits, formatted };
    }

    return {
      ok: false,
      digits,
      formatted,
      message: '전화번호를 입력하세요.',
    };
  }

  const valid = options.mobileOnly
    ? isKoreanMobilePhoneParity(digits)
    : isKoreanPhoneNumberParity(digits);

  if (!valid) {
    return {
      ok: false,
      digits,
      formatted,
      message: options.mobileOnly
        ? '올바른 휴대전화 번호가 아닙니다.'
        : '올바른 전화번호 형식이 아닙니다.',
    };
  }

  return {
    ok: true,
    digits,
    formatted,
  };
}

module.exports.normalizePhoneDigits = normalizePhoneDigitsParity;
module.exports.formatKoreanPhoneNumber = formatKoreanPhoneNumberParity;
module.exports.isKoreanMobilePhone = isKoreanMobilePhoneParity;
module.exports.isKoreanPhoneNumber = isKoreanPhoneNumberParity;
module.exports.validateKoreanPhoneNumber = validateKoreanPhoneNumberParity;
