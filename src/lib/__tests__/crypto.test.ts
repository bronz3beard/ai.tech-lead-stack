import { encrypt, decrypt } from '../crypto';

describe('crypto', () => {
  const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    if (ORIGINAL_ENCRYPTION_KEY === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
    }
  });

  describe('getEncryptionKey error handling', () => {
    it('should throw an error if ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw an error if ENCRYPTION_KEY is not exactly 64 characters', () => {
      process.env.ENCRYPTION_KEY = 'shortkey';
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');

      process.env.ENCRYPTION_KEY = 'a'.repeat(63);
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');

      process.env.ENCRYPTION_KEY = 'a'.repeat(65);
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
    });
  });

  describe('encrypt and decrypt', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    it('should correctly encrypt and decrypt a string', () => {
      const plaintext = 'super secret message';
      const ciphertext = encrypt(plaintext);

      // Check the format of the ciphertext
      expect(ciphertext.split(':').length).toBe(3);

      const decrypted = decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw an error during decrypt if format is invalid', () => {
      expect(() => decrypt('invalid-format')).toThrow('Invalid ciphertext format. Expected <iv>:<ciphertext>:<authtag>');
      expect(() => decrypt('part1:part2')).toThrow('Invalid ciphertext format. Expected <iv>:<ciphertext>:<authtag>');
    });
  });
});
