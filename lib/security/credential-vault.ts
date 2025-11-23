import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce recommended for GCM

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const rawKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is not set');
  }

  const tryBase64 = Buffer.from(rawKey, 'base64');
  if (tryBase64.length === 32) {
    cachedKey = tryBase64;
    return cachedKey;
  }

  const tryHex = Buffer.from(rawKey, 'hex');
  if (tryHex.length === 32) {
    cachedKey = tryHex;
    return cachedKey;
  }

  throw new Error(
    'CREDENTIAL_ENCRYPTION_KEY must be a 32-byte key encoded as base64 or hex'
  );
}

interface SerializablePayload {
  [key: string]: any;
}

function normalizePayload(payload: SerializablePayload): SerializablePayload {
  return Object.entries(payload).reduce<SerializablePayload>((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function encryptCredentialPayload(payload: SerializablePayload): string {
  const normalized = normalizePayload(payload);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(normalized), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptCredentialPayload(serialized: string): SerializablePayload {
  const [ivB64, tagB64, cipherTextB64] = serialized.split(':');

  if (!ivB64 || !tagB64 || !cipherTextB64) {
    throw new Error('Invalid credential payload format');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const cipherText = Buffer.from(cipherTextB64, 'base64');

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

