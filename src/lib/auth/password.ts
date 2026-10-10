import 'server-only';
import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id with OWASP-recommended baseline parameters
 * (m=19 MiB, t=2, p=1). Encoded hashes carry their own parameters, so these can
 * be raised later; `needsRehash` lets login transparently upgrade old hashes.
 */
const PARAMS = {
  algorithm: 2 /* Argon2id */,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS);
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  try {
    return await verify(encoded, password);
  } catch {
    return false;
  }
}

export function needsRehash(encoded: string): boolean {
  return !encoded.startsWith(
    `$argon2id$v=19$m=${PARAMS.memoryCost},t=${PARAMS.timeCost},p=${PARAMS.parallelism}$`,
  );
}

// Pre-computed hash of a random string: verifying against it when the account
// does not exist keeps login timing similar (reduces account enumeration).
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(`dummy-${Math.random()}`);
  await verifyPassword(await dummyHash, password);
}
