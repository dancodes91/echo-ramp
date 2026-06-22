import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export function computeRequestSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: string,
): string {
  const payload = `${method.toUpperCase()}:${path}:${timestamp}:${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyRequestSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = computeRequestSignature(secret, method, path, timestamp, body);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
