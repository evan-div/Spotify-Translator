import { createHash, randomBytes } from 'node:crypto';

const base64Url = (buffer: Buffer): string =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function createCodeVerifier(): string {
  return base64Url(randomBytes(64));
}

export function createCodeChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest());
}

export function createState(): string {
  return base64Url(randomBytes(16));
}
