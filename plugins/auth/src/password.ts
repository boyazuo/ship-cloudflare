/** Measured ~70ms on Node WebCrypto. Workers Free (10ms) cannot run this. */
const ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${encode(salt)}$${encode(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, rounds, saltPart, hashPart] = stored.split('$');
  const iterations = Number(rounds);
  if (scheme !== 'pbkdf2' || iterations !== ITERATIONS || !saltPart || !hashPart) return false;
  const salt = decode(saltPart);
  const expected = decode(hashPart);
  if (!salt || !expected) return false;
  const actual = await derive(password, salt, iterations);
  return sameBytes(actual, expected);
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer(salt), iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function saltBuffer(salt: Uint8Array): ArrayBuffer {
  return salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}
