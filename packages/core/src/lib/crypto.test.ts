import { encrypt, decrypt } from '../crypto';

describe('crypto', () => {
  const originalEnv = process.env;
  const validKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('encrypt and decrypt', () => {
    it('should successfully encrypt and decrypt a string with a valid key', () => {
      process.env.ENCRYPTION_KEY = validKey;
      const plaintext = 'This is a secret message!';

      const ciphertext = encrypt(plaintext);
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext.split(':').length).toBe(3);

      const decrypted = decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should successfully encrypt and decrypt empty strings', () => {
      process.env.ENCRYPTION_KEY = validKey;
      const plaintext = '';

      const ciphertext = encrypt(plaintext);
      const decrypted = decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('ENCRYPTION_KEY validation', () => {
    it('should throw an error if ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow(
        'ENCRYPTION_KEY environment variable is not set'
      );
      expect(() => decrypt('part1:part2:part3')).toThrow(
        'ENCRYPTION_KEY environment variable is not set'
      );
    });

    it('should throw an error if ENCRYPTION_KEY is not 64 characters', () => {
      process.env.ENCRYPTION_KEY = 'short';
      expect(() => encrypt('test')).toThrow(
        'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'
      );
      expect(() => decrypt('part1:part2:part3')).toThrow(
        'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'
      );
    });
  });

  describe('decrypt error handling', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      process.env.ENCRYPTION_KEY = validKey;
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should throw an error if ciphertext format is invalid', () => {
      expect(() => decrypt('invalid_format')).toThrow(
        'Invalid ciphertext format. Expected <iv>:<ciphertext>:<authtag>'
      );
      expect(() => decrypt('part1:part2')).toThrow(
        'Invalid ciphertext format. Expected <iv>:<ciphertext>:<authtag>'
      );
      expect(() => decrypt('part1:part2:part3:part4')).toThrow(
        'Invalid ciphertext format. Expected <iv>:<ciphertext>:<authtag>'
      );
    });

    it('should fail to decrypt if ciphertext is tampered with', () => {
      const plaintext = 'Secret data';
      const ciphertext = encrypt(plaintext);

      const parts = ciphertext.split(':');
      // Modify the ciphertext part significantly to ensure it changes
      parts[1] =
        parts[1] === '0000000000000000000000'
          ? '1111111111111111111111'
          : '0000000000000000000000';
      const tamperedCiphertext = parts.join(':');

      expect(() => decrypt(tamperedCiphertext)).toThrow(); // Decipher throws when auth tag fails
    });

    it('should fail to decrypt if auth tag is tampered with', () => {
      const plaintext = 'Secret data';
      const ciphertext = encrypt(plaintext);

      const parts = ciphertext.split(':');
      // Modify the auth tag
      parts[2] = '00000000000000000000000000000000';
      const tamperedAuthTag = parts.join(':');

      expect(() => decrypt(tamperedAuthTag)).toThrow(); // Decipher throws when auth tag fails
    });
  });
});
