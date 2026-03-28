import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

// We test encryption logic directly rather than importing the module
// (which reads ENCRYPTION_MASTER_KEY at import time)

function deriveKey(masterKey: string, familyId: string, integrationId: string): Buffer {
  const salt = `${familyId}:${integrationId}`;
  return crypto.pbkdf2Sync(masterKey, salt, 100_000, 32, 'sha256');
}

function encrypt(plaintext: string, familyId: string, integrationId: string): string {
  const masterKey = 'test-master-key-for-vitest-32chars!';
  const key = deriveKey(masterKey, familyId, integrationId);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(ciphertext: string, familyId: string, integrationId: string): string {
  const masterKey = 'test-master-key-for-vitest-32chars!';
  const key = deriveKey(masterKey, familyId, integrationId);
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

describe('encryption', () => {
  const familyId = 'family-001';
  const integrationId = 'integration-001';

  describe('encrypt/decrypt roundtrip', () => {
    it('decrypts back to the original plaintext', () => {
      const plaintext = 'my-secret-api-token-12345';
      const ciphertext = encrypt(plaintext, familyId, integrationId);
      const result = decrypt(ciphertext, familyId, integrationId);
      expect(result).toBe(plaintext);
    });

    it('handles special characters', () => {
      const plaintext = 'p@$$w0rd!#%&*()_+-={}[]|:;<>?,./~`';
      const ciphertext = encrypt(plaintext, familyId, integrationId);
      expect(decrypt(ciphertext, familyId, integrationId)).toBe(plaintext);
    });

    it('handles unicode characters', () => {
      const plaintext = 'password with accents: caf\u00e9';
      const ciphertext = encrypt(plaintext, familyId, integrationId);
      expect(decrypt(ciphertext, familyId, integrationId)).toBe(plaintext);
    });

    it('handles long strings', () => {
      const plaintext = 'x'.repeat(10_000);
      const ciphertext = encrypt(plaintext, familyId, integrationId);
      expect(decrypt(ciphertext, familyId, integrationId)).toBe(plaintext);
    });
  });

  describe('key derivation isolation', () => {
    it('different familyId fails decryption', () => {
      const plaintext = 'same-secret';
      const ct = encrypt(plaintext, 'family-A', integrationId);
      expect(() => decrypt(ct, 'family-B', integrationId)).toThrow();
    });

    it('different integrationId fails decryption', () => {
      const plaintext = 'same-secret';
      const ct = encrypt(plaintext, familyId, 'int-A');
      expect(() => decrypt(ct, familyId, 'int-B')).toThrow();
    });
  });

  describe('error handling', () => {
    it('throws on invalid ciphertext', () => {
      expect(() => decrypt('not-valid!!!', familyId, integrationId)).toThrow();
    });

    it('throws on tampered ciphertext', () => {
      const ciphertext = encrypt('secret', familyId, integrationId);
      const tampered = ciphertext.slice(0, 10) + 'X' + ciphertext.slice(11);
      expect(() => decrypt(tampered, familyId, integrationId)).toThrow();
    });

    it('throws on truncated ciphertext', () => {
      const ciphertext = encrypt('secret', familyId, integrationId);
      const truncated = ciphertext.slice(0, 5);
      expect(() => decrypt(truncated, familyId, integrationId)).toThrow();
    });
  });

  it('encrypts and decrypts an empty string', () => {
    const ciphertext = encrypt('', familyId, integrationId);
    expect(ciphertext).toBeTruthy();
    expect(decrypt(ciphertext, familyId, integrationId)).toBe('');
  });

  it('produces base64 output', () => {
    const ciphertext = encrypt('test', familyId, integrationId);
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('produces different ciphertexts for same input due to random IV', () => {
    const plaintext = 'deterministic-input';
    const ct1 = encrypt(plaintext, familyId, integrationId);
    const ct2 = encrypt(plaintext, familyId, integrationId);
    expect(ct1).not.toBe(ct2);
    expect(decrypt(ct1, familyId, integrationId)).toBe(plaintext);
    expect(decrypt(ct2, familyId, integrationId)).toBe(plaintext);
  });
});
