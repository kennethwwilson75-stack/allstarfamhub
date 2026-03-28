import crypto from 'node:crypto';

const MASTER_KEY = process.env['ENCRYPTION_MASTER_KEY'] ?? '';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;

/**
 * Derive an encryption key from the master key + context-specific salt.
 * Uses PBKDF2 to bind the key to a specific family + integration pair.
 */
function deriveKey(familyId: string, integrationId: string): Buffer {
  const salt = `${familyId}:${integrationId}`;
  return crypto.pbkdf2Sync(
    MASTER_KEY,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    'sha256',
  );
}

/**
 * Encrypt plaintext using AES-256-GCM with a derived key.
 * Returns base64-encoded string: iv + authTag + ciphertext.
 */
export function encrypt(
  plaintext: string,
  familyId: string,
  integrationId: string,
): string {
  const key = deriveKey(familyId, integrationId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv (12) + authTag (16) + ciphertext
  const result = Buffer.concat([iv, authTag, encrypted]);
  return result.toString('base64');
}

/**
 * Decrypt a base64-encoded ciphertext produced by encrypt().
 */
export function decrypt(
  ciphertext: string,
  familyId: string,
  integrationId: string,
): string {
  const key = deriveKey(familyId, integrationId);
  const data = Buffer.from(ciphertext, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
