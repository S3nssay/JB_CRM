/**
 * Token Encryption Utilities
 *
 * Provides secure encryption/decryption for OAuth tokens at rest.
 * Uses AES-256-GCM for authenticated encryption.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a 256-bit encryption key from a passphrase using PBKDF2.
 * The salt is derived from the passphrase itself for deterministic key generation.
 */
function getEncryptionKey(): Buffer {
  const passphrase = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;

  if (!passphrase) {
    throw new Error('EMAIL_TOKEN_ENCRYPTION_KEY environment variable is required');
  }

  // Use a static salt derived from the passphrase for deterministic key generation
  // In production, consider using a per-record salt stored alongside the ciphertext
  const salt = crypto.createHash('sha256').update(passphrase + '-salt').digest().slice(0, 16);

  return crypto.pbkdf2Sync(passphrase, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns base64-encoded ciphertext with IV and auth tag prepended.
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + ciphertext
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64')
  ]);

  return combined.toString('base64');
}

/**
 * Decrypts a ciphertext string encrypted with encryptToken.
 * Extracts IV and auth tag from the combined format.
 */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, 'base64');

  // Extract IV, authTag, and encrypted data
  const iv = combined.slice(0, IV_LENGTH);
  const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encryptedData = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generates a cryptographically secure random string.
 * Useful for client state tokens in OAuth flows.
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generates a cryptographically secure client state for webhook validation.
 */
export function generateClientState(): string {
  return crypto.randomBytes(32).toString('hex');
}
