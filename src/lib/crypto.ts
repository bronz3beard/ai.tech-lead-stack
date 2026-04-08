import * as crypto from 'crypto';

/**
 * AES-256-GCM encryption key derived from environment variables.
 * Needs to be 32 bytes (64 hex characters).
 */
function getEncryptionKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (hexKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * @desc Encrypts plaintext using AES-256-GCM.
 *       Reads key from process.env.ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * @param plaintext - The value to encrypt
 * @returns Self-contained encrypted string: "<iv>:<ciphertext>:<authtag>"
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * @desc Decrypts a value produced by encrypt().
 * @param ciphertext - The "<iv>:<ciphertext>:<authtag>" string from DB
 * @returns Original plaintext
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format. Expected <iv>:<ciphertext>:<authtag>');
  }

  const [ivHex, encryptedHex, authTagHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
