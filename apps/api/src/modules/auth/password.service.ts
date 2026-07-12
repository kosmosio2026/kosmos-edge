import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    if (!passwordHash) {
      return false;
    }

    if (this.isArgonHash(passwordHash)) {
      return argon2.verify(passwordHash, password);
    }

    if (this.isBcryptHash(passwordHash)) {
      return bcrypt.compare(password, passwordHash);
    }

    return false;
  }

  needsRehash(passwordHash: string): boolean {
    return !this.isArgonHash(passwordHash);
  }

  private isArgonHash(hash: string): boolean {
    return hash.startsWith('$argon2id$') || hash.startsWith('$argon2i$');
  }

  private isBcryptHash(hash: string): boolean {
    return (
      hash.startsWith('$2a$') ||
      hash.startsWith('$2b$') ||
      hash.startsWith('$2y$')
    );
  }
}