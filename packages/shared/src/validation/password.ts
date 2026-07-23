export type PasswordValidationResult = {
  ok: boolean;
  valid: boolean;
  messages: string[];
};

export const PASSWORD_POLICY_HINT =
  '비밀번호는 8자 이상이며, 영문 소문자와 숫자를 각각 1개 이상 포함해야 합니다.';

export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*\d).{8,}$/;

export function validatePassword(password: string): PasswordValidationResult {
  const messages: string[] = [];

  if (!password || password.length < 8) {
    messages.push('비밀번호는 8자 이상이어야 합니다.');
  }

  if (!/[a-z]/.test(password)) {
    messages.push('영문 소문자를 포함해야 합니다.');
  }

  if (!/\d/.test(password)) {
    messages.push('숫자를 포함해야 합니다.');
  }

  const ok = messages.length === 0;

  return {
    ok,
    valid: ok,
    messages,
  };
}

export function isValidPassword(password: string) {
  return validatePassword(password).ok;
}

export function getPasswordPolicyHint() {
  return PASSWORD_POLICY_HINT;
}
