/** Experimental TESTNET-only MiMC7/Groth16 helpers. Never send a note secret to a service. */
import { createHash, randomBytes } from 'node:crypto';
export const FIELD = 52435875175126190479447740508185965837690552500527637822603658699938581184513n;
export const ROUNDS = 110;
export const constants = Array.from({ length: ROUNDS }, (_, i) => i === 0 ? 0n : BigInt('0x' + createHash('sha256').update(`pacta-mimc7-bls12-381-v1:${i}`).digest('hex')) % FIELD);
export const mod = x => ((BigInt(x) % FIELD) + FIELD) % FIELD;
export function mimc7(input, key) {
  let x = mod(input), k = mod(key);
  for (const c of constants) { const t = mod(x + k + c), t2 = mod(t*t), t4 = mod(t2*t2); x = mod(t4*t2*t); }
  return mod(x + k + BigInt(input));
}
export function inverse(n) { let a = mod(n), b = FIELD, x = 1n, y = 0n; if (!a) throw new Error('Zero secret'); while (b) { const q = a/b; [a,b] = [b,a-q*b]; [x,y] = [y,x-q*y]; } return mod(x); }
export function scalarHex(value) { const x = BigInt(value); if (x < 0n || x >= FIELD) throw new Error('Noncanonical scalar'); return x.toString(16).padStart(64,'0'); }
export function addressContext(addressScValXdr) { const h = createHash('sha256').update(addressScValXdr).digest('hex'); return [BigInt('0x'+h.slice(0,32)),BigInt('0x'+h.slice(32))]; }
export function createNote() { const secret = BigInt('0x'+randomBytes(31).toString('hex')) || 1n, blinding = BigInt('0x'+randomBytes(31).toString('hex')); return { version: 1, secret: secret.toString(), blinding: blinding.toString(), commitment: mimc7(secret,blinding).toString() }; }
export function noteWitness(note, commitments, recipientContext, domainContext) {
  if (commitments.length !== 4) throw new Error('A full four-note batch is required');
  const secret = BigInt(note.secret), blinding = BigInt(note.blinding);
  if (!secret || secret >= FIELD || secret < 0n || blinding < 0n || blinding >= FIELD) throw new Error('Invalid note');
  if (!commitments.map(String).includes(mimc7(secret,blinding).toString())) throw new Error('Note is not in the funded batch');
  return { secret: secret.toString(), secretInverse: inverse(secret).toString(), blinding: blinding.toString(), recipientHi: String(recipientContext[0]), recipientLo: String(recipientContext[1]), domainHi: String(domainContext[0]), domainLo: String(domainContext[1]), commitments: commitments.map(String) };
}
export function noteSignals(witness) { const n = mimc7(mimc7(witness.secret,witness.domainHi),witness.domainLo); const tag = mimc7(mimc7(witness.secret,witness.recipientHi),witness.recipientLo); return [n,tag,witness.recipientHi,witness.recipientLo,witness.domainHi,witness.domainLo,...witness.commitments].map(String); }
const FQ = 4002409555221667393417789825735904156556882819939007885332058136124031650490837864442687629129015664037894272559787n;
function fqHex(n) { const x=BigInt(n); if (x<0n || x>=FQ) throw new Error('Noncanonical point coordinate'); return x.toString(16).padStart(96,'0'); }
function g1(p) { return fqHex(p[0])+fqHex(p[1]); }
// Host encoding uses big-endian x.c1 || x.c0 || y.c1 || y.c0; snarkjs JSON uses c0,c1.
function g2(p) { return fqHex(p[0][1])+fqHex(p[0][0])+fqHex(p[1][1])+fqHex(p[1][0]); }
export function proofToHex(proof) { if (proof.protocol !== 'groth16' || proof.curve !== 'bls12381') throw new Error('Expected BLS12-381 Groth16 proof'); return g1(proof.pi_a)+g2(proof.pi_b)+g1(proof.pi_c); }
export function verificationKeyToHex(vk) { if (vk.nPublic !== 10 || vk.IC.length !== 11 || vk.curve !== 'bls12381') throw new Error('Wrong private-payment circuit key'); return g1(vk.vk_alpha_1)+g2(vk.vk_beta_2)+g2(vk.vk_gamma_2)+g2(vk.vk_delta_2)+vk.IC.length.toString(16).padStart(8,'0')+vk.IC.map(g1).join(''); }
export function batchRoot(commitments) { return createHash('sha256').update(Buffer.from(commitments.map(scalarHex).join(''),'hex')).digest('hex'); }

export const commitment = (secret, blinding) => mimc7(secret, blinding);
export const nullifier = (secret, hi, lo) => mimc7(mimc7(secret, hi), lo);
export const spendTag = (secret, hi, lo) => mimc7(mimc7(secret, hi), lo);
export const addressLimbs = addressContext;
export const serializeProof = proofToHex;
export const serializeVerificationKey = verificationKeyToHex;
export const witness = noteWitness;
