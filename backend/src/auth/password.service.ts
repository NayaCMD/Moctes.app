import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = (await scryptAsync(
      password,
      salt,
      KEY_LENGTH,
    )) as Buffer;
    return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [algorithm, encodedSalt, encodedKey] = encodedHash.split('$');
    if (algorithm !== 'scrypt' || !encodedSalt || !encodedKey) {
      return false;
    }

    try {
      const salt = Buffer.from(encodedSalt, 'base64url');
      const expected = Buffer.from(encodedKey, 'base64url');
      if (expected.length !== KEY_LENGTH) {
        return false;
      }
      const actual = (await scryptAsync(
        password,
        salt,
        expected.length,
      )) as Buffer;
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
