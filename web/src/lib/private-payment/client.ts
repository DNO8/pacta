'use client';

import { Contract, nativeToScVal, StrKey } from '@stellar/stellar-sdk';
import { FIXED_STROOPS, requirePrivatePaymentReady } from './config';
import { addressLimbs, bytesHex, FIELD, fieldHex, hexBytes, inverse, mimc7, randomScalar, serializeProof, validateRecipient, type Groth16Proof } from './crypto';
import { assertTestnet, awaitTransaction, fundedEphemeralAccount, hasNativeTransfer, nativeAssetId, readPool, sendOperation, server, toAddress, toFieldBytes } from './rpc';

export interface PrivateNote { version: 1; secret: string; blinding: string; commitment: string; network: 'TESTNET'; poolId: string; }
export interface DepositReceipt { txHash: string | null; ledger: number | null; batch?: number; syntheticDeposits?: number; }
export interface PrivateProof { proof: Groth16Proof; publicSignals: string[]; batch: number; recipient: string; poolId: string; }
export interface PaymentReceipt { txHash: string; ledger: number; recipient: string; amount: string; verified: true; }
interface Batch { commitments: Uint8Array[]; root: Uint8Array | null; }
interface PoolConfig { token: string; denomination: bigint; current_batch: number; }
const pendingDeposits = new Map<string, string>();
const pendingWithdrawals = new Map<string, string>();

async function checkedDeployment() {
  const config = requirePrivatePaymentReady();
  await assertTestnet();
  if (config.assetId !== nativeAssetId || !config.poolId || !config.readerAccount) throw new Error('Configuración del activo inválida.');
  const onchain: PoolConfig = await readPool(config.poolId, config.readerAccount, 'config');
  if (onchain.token !== nativeAssetId || BigInt(onchain.denomination) !== BigInt(FIXED_STROOPS)) throw new Error('El pool no corresponde a 1 XLM de Testnet.');
  return { ...config, poolId: config.poolId, readerAccount: config.readerAccount, currentBatch: Number(onchain.current_batch) };
}

export function validateNote(note: PrivateNote) {
  const config = requirePrivatePaymentReady();
  if (Object.keys(note).sort().join(',') !== 'blinding,commitment,network,poolId,secret,version' || note.version !== 1 || note.network !== 'TESTNET' || note.poolId !== config.poolId || !StrKey.isValidContract(note.poolId)) throw new Error('La nota no pertenece a este pool testnet.');
  if (![note.secret, note.blinding].every(x => /^[1-9][0-9]{0,76}$/.test(x) && BigInt(x) < FIELD)) throw new Error('Los secretos de la nota no son válidos.');
  if (!/^[a-f0-9]{64}$/.test(note.commitment) || fieldHex(mimc7(note.secret, note.blinding)) !== note.commitment) throw new Error('El compromiso no coincide con la nota.');
}

export async function createNote(): Promise<PrivateNote> {
  const config = await checkedDeployment();
  const secret = randomScalar().toString(), blinding = randomScalar().toString();
  return { version: 1, network: 'TESTNET', poolId: config.poolId, secret, blinding, commitment: fieldHex(mimc7(secret, blinding)) };
}
export async function createDemoRecipient(): Promise<string> { requirePrivatePaymentReady(); return (await fundedEphemeralAccount()).publicKey(); }

async function findBatch(note: PrivateNote, reader: string): Promise<number | null> {
  const result = await readPool(note.poolId, reader, 'find_commitment', [nativeToScVal(hexBytes(note.commitment))]);
  if (result === null || result === undefined) return null;
  const batch = Number(result);
  if (!Number.isInteger(batch) || batch < 0 || batch > 0xffffffff) throw new Error('Índice de lote inválido.');
  return batch;
}

export async function deposit(note: PrivateNote): Promise<DepositReceipt> {
  validateNote(note);
  const config = await checkedDeployment();
  let batchIndex = await findBatch(note, config.readerAccount);
  const key = await fundedEphemeralAccount();
  const pool = new Contract(config.poolId);
  let txHash: string | null = pendingDeposits.get(note.commitment) ?? null;
  let ledger: number | null = null;
  if (batchIndex === null) {
    if (!txHash) {
      txHash = await sendOperation(key, pool.call('deposit', toAddress(key.publicKey()), nativeToScVal(hexBytes(note.commitment))));
      pendingDeposits.set(note.commitment, txHash);
    }
    const confirmed = await awaitTransaction(txHash);
    ledger = confirmed.ledger;
    batchIndex = await findBatch(note, config.readerAccount);
    if (batchIndex === null) throw new Error('El depósito no aparece en el pool.');
  }
  let syntheticDeposits = 0;
  // Synthetic cover is clearly labelled by the UI. It is NOT independent-user anonymity.
  for (let i = 0; i < 3; i++) {
    const batch: Batch = await readPool(config.poolId, config.readerAccount, 'snapshot', [nativeToScVal(batchIndex, { type: 'u32' })]);
    if (batch.commitments.length === 4) break;
    const cover = mimc7(randomScalar(), randomScalar());
    const coverHash = await sendOperation(key, pool.call('deposit', toAddress(key.publicKey()), toFieldBytes(cover)));
    await awaitTransaction(coverHash); syntheticDeposits++;
  }
  return { txHash, ledger, batch: batchIndex, syntheticDeposits };
}

async function verifiedArtifact(path: string, expectedHash: string | null): Promise<Uint8Array> {
  if (!expectedHash) throw new Error('Falta la huella del artefacto de prueba.');
  const response = await fetch(path, { cache: 'no-cache', signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('No se pudo descargar el artefacto de prueba.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 32 * 1024 * 1024) throw new Error('Artefacto excesivamente grande.');
  const digest = bytesHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  if (digest !== expectedHash) throw new Error('El artefacto de prueba no coincide con este despliegue.');
  return bytes;
}

export async function prove(note: PrivateNote, recipient: string): Promise<PrivateProof> {
  validateNote(note); validateRecipient(recipient);
  const config = await checkedDeployment();
  const batchIndex = await findBatch(note, config.readerAccount);
  if (batchIndex === null) throw new Error('La nota no tiene un depósito financiado.');
  const batch: Batch = await readPool(config.poolId, config.readerAccount, 'snapshot', [nativeToScVal(batchIndex, { type: 'u32' })]);
  const commitments = batch.commitments.map(c => BigInt('0x' + bytesHex(c)).toString());
  if (commitments.length !== 4 || !batch.root || !commitments.includes(BigInt('0x' + note.commitment).toString())) throw new Error('El lote aún no tiene cuatro depósitos financiados.');
  const [recipientHi, recipientLo] = addressLimbs(recipient), [domainHi, domainLo] = addressLimbs(config.poolId);
  const witness = { secret: note.secret, secretInverse: inverse(BigInt(note.secret)).toString(), blinding: note.blinding, recipientHi, recipientLo, domainHi, domainLo, commitments };
  const expected = [mimc7(mimc7(note.secret, domainHi), domainLo), mimc7(mimc7(note.secret, recipientHi), recipientLo), recipientHi, recipientLo, domainHi, domainLo, ...commitments].map(String);
  const [wasm, zkey, vkey] = await Promise.all([
    verifiedArtifact('/private-payment/private_payment.wasm', config.wasmSha256),
    verifiedArtifact('/private-payment/private_payment.zkey', config.zkeySha256),
    verifiedArtifact('/private-payment/verification_key.json', config.verificationKeySha256),
  ]);
  const { groth16 } = await import('snarkjs');
  const { proof, publicSignals } = await groth16.fullProve(witness, wasm, zkey);
  if (JSON.stringify(expected) !== JSON.stringify(publicSignals) || !(await groth16.verify(JSON.parse(new TextDecoder().decode(vkey)), publicSignals, proof))) throw new Error('La prueba local no supera la verificación.');
  return { proof, publicSignals, batch: batchIndex, recipient, poolId: config.poolId };
}

export async function withdraw(bundle: PrivateProof, recipient: string): Promise<{ txHash: string }> {
  validateRecipient(recipient);
  const config = await checkedDeployment();
  if (bundle.recipient !== recipient || bundle.poolId !== config.poolId || bundle.publicSignals.length !== 10) throw new Error('La prueba no corresponde al destinatario o al pool.');
  const nullifier = bundle.publicSignals[0];
  if (pendingWithdrawals.has(nullifier)) return { txHash: pendingWithdrawals.get(nullifier)! };
  // A new test account pays the fee; never reuse the depositor as the withdrawal source.
  const relay = await fundedEphemeralAccount();
  const txHash = await sendOperation(relay, new Contract(config.poolId).call('withdraw', nativeToScVal(bundle.batch, { type: 'u32' }), toAddress(recipient), toFieldBytes(nullifier), toFieldBytes(bundle.publicSignals[1]), nativeToScVal(serializeProof(bundle.proof))));
  pendingWithdrawals.set(nullifier, txHash);
  return { txHash };
}

export async function verify(txHash: string, recipient: string): Promise<PaymentReceipt> {
  validateRecipient(recipient);
  const config = await checkedDeployment();
  if (!/^[a-f0-9]{64}$/.test(txHash)) throw new Error('Identificador de transacción inválido.');
  // Fresh RPC lookup, never trusting local stage state or an AI explanation.
  await server.getTransaction(txHash);
  const tx = await awaitTransaction(txHash);
  if (!hasNativeTransfer(tx, config.poolId, recipient)) throw new Error('No se encontró una transferencia real de 1 XLM desde este pool al destinatario.');
  return { txHash, ledger: tx.ledger, recipient, amount: '1', verified: true };
}
