import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';

const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(
  password: string,
): Promise<string> {
  return argon2.hash(password, ARGON2ID_OPTIONS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash) {
    return false;
  }

  if (passwordHash.startsWith('$argon2')) {
    return argon2.verify(passwordHash, password);
  }

  if (
    passwordHash.startsWith('$2a$') ||
    passwordHash.startsWith('$2b$') ||
    passwordHash.startsWith('$2y$')
  ) {
    return bcrypt.compare(password, passwordHash);
  }

  return false;
}

export function needsPasswordRehash(
  passwordHash: string,
): boolean {
  return !passwordHash.startsWith('$argon2id$');
}
