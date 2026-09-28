import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Encrypts secrets at rest (MP access token, Fudo API token) — the
// PizzaZeka prototype stores these as plaintext in its `config` table,
// which the plan explicitly calls out as a gap to fix on the port.
// AES-256-GCM with a key derived from ENCRYPTION_KEY (set per-environment,
// never committed) — enough for "not plaintext in the DB," not a KMS.

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY no está configurada (ver .env.example).');
  }
  return scryptSync(secret, 'justfood-secrets', 32);
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split('.');
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Formato de secreto encriptado inválido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
