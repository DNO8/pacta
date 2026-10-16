// Constants generated from circuits/crypto.mjs; parity covered by the test suite.
import { Address, hash, StrKey } from '@stellar/stellar-sdk';
import roundConstants from './mimc-constants.json';
export const FIELD = 52435875175126190479447740508185965837690552500527637822603658699938581184513n;
const constants = roundConstants.map(BigInt);
export const mod = (x: bigint) => ((x % FIELD) + FIELD) % FIELD;
export function mimc7(input: bigint | string, key: bigint | string): bigint {
  let x = mod(BigInt(input)); const k = mod(BigInt(key));
  for (const c of constants) { const t = mod(x + k + c), t2 = mod(t * t), t4 = mod(t2 * t2); x = mod(t4 * t2 * t); }
  return mod(x + k + BigInt(input));
}
export function inverse(n: bigint): bigint {
  let a = mod(n), b = FIELD, x = 1n, y = 0n;
  if (!a) throw new Error('Secreto inválido.');
  while (b) { const q = a / b; [a, b] = [b, a - q * b]; [x, y] = [y, x - q * y]; }
  return mod(x);
}
export function randomScalar(): bigint {
  let n = 0n;
  while (!n) n = BigInt('0x' + bytesHex(crypto.getRandomValues(new Uint8Array(31))));
  return n;
}
export function bytesHex(bytes: Uint8Array): string { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
export function hexBytes(hex: string): Uint8Array {
  if (!/^(?:[a-f0-9]{2})+$/.test(hex)) throw new Error('Bytes inválidos.');
  return Uint8Array.from(hex.match(/../g)!, b => parseInt(b, 16));
}
export function fieldHex(n: bigint | string): string {
  const v = BigInt(n); if (v < 0n || v >= FIELD) throw new Error('Escalar no canónico.');
  return v.toString(16).padStart(64, '0');
}
export function addressLimbs(value: string): [string, string] {
  const digest = bytesHex(hash(new Address(value).toScVal().toXdr()));
  return [BigInt('0x' + digest.slice(0, 32)).toString(), BigInt('0x' + digest.slice(32)).toString()];
}
export function validateRecipient(value: string) {
  if (!StrKey.isValidEd25519PublicKey(value)) throw new Error('La cuenta receptora no es una dirección Stellar válida.');
  return value;
}
export interface Groth16Proof { protocol: string; curve: string; pi_a: string[]; pi_b: string[][]; pi_c: string[]; }
const FQ = 4002409555221667393417789825735904156556882819939007885332058136124031650490837864442687629129015664037894272559787n;
function coordinate(value: string): string { const v = BigInt(value); if (v < 0n || v >= FQ) throw new Error('Coordenada no canónica.'); return v.toString(16).padStart(96, '0'); }
export function serializeProof(proof: Groth16Proof): Uint8Array {
  if (proof.protocol !== 'groth16' || proof.curve !== 'bls12381') throw new Error('La prueba no usa BLS12-381 Groth16.');
  const g1 = (p: string[]) => coordinate(p[0]) + coordinate(p[1]);
  const g2 = (p: string[][]) => coordinate(p[0][1]) + coordinate(p[0][0]) + coordinate(p[1][1]) + coordinate(p[1][0]);
  return hexBytes(g1(proof.pi_a) + g2(proof.pi_b) + g1(proof.pi_c));
}
