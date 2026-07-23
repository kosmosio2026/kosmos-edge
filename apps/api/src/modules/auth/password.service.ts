import { Injectable } from '@nestjs/common';
import {
  hashPassword as createPasswordHash,
  needsPasswordRehash,
  verifyPassword as verifyPasswordHash,
} from '@parking/db/security/password';

@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    return createPasswordHash(password);
  }

  async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return verifyPasswordHash(password, passwordHash);
  }

  needsRehash(passwordHash: string): boolean {
    return needsPasswordRehash(passwordHash);
  }
}
