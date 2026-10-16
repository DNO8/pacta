import { Account, Address, Asset, Contract, Keypair, Networks, StrKey, TransactionBuilder, nativeToScVal, rpc, scValToNative, type xdr } from '@stellar/stellar-sdk';
import { FIXED_STROOPS, TESTNET_PASSPHRASE, TESTNET_RPC } from './config';

export const server = new rpc.Server(TESTNET_RPC);
export const nativeAssetId = Asset.native().contractId(Networks.TESTNET);

export async function assertTestnet() {
  const network = await server.getNetwork();
  if (network.passphrase !== TESTNET_PASSPHRASE) throw new Error('La red RPC no es Stellar Testnet. Operación cancelada.');
}

export async function fundedEphemeralAccount(): Promise<Keypair> {
  await assertTestnet();
  const key = Keypair.random();
  const response = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(key.publicKey())}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Friendbot no pudo financiar la cuenta de prueba.');
  await server.getAccount(key.publicKey());
  return key;
}

export async function readPool(poolId: string, reader: string, method: string, args: xdr.ScVal[] = []) {
  const tx = new TransactionBuilder(new Account(reader, '0'), { fee: '100000', networkPassphrase: TESTNET_PASSPHRASE })
    .addOperation(new Contract(poolId).call(method, ...args)).setTimeout(60).build();
  const simulation = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simulation) || !simulation.result) throw new Error('No se pudo leer el estado del pool en Testnet.');
  return scValToNative(simulation.result.retval);
}

export async function sendOperation(key: Keypair, operation: xdr.Operation) {
  await assertTestnet();
  const account = await server.getAccount(key.publicKey());
  const tx = new TransactionBuilder(account, { fee: '100000', networkPassphrase: TESTNET_PASSPHRASE })
    .addOperation(operation).setTimeout(180).build();
  const prepared = await server.prepareTransaction(tx);
  if (BigInt(prepared.fee) > 2000000000n) throw new Error('La comisión de prueba supera el límite de seguridad.');
  prepared.sign(key);
  const sent = await server.sendTransaction(prepared);
  if (!['PENDING', 'DUPLICATE'].includes(sent.status)) throw new Error('Stellar rechazó la transacción. No se confirmó ningún pago.');
  return sent.hash;
}

export async function awaitTransaction(hash: string): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  for (let i = 0; i < 45; i++) {
    const tx = await server.getTransaction(hash);
    if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) return tx;
    if (tx.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error('La transacción falló en Stellar.');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error(`La transacción sigue sin confirmarse. Consulta su estado antes de repetirla: ${hash}`);
}

export function toFieldBytes(value: string | bigint) {
  return nativeToScVal(Uint8Array.from(BigInt(value).toString(16).padStart(64, '0').match(/../g)!.map(x => parseInt(x, 16))));
}
export function toAddress(value: string) { return new Address(value).toScVal(); }

/** Requires an actual native-token transfer event in the successful withdrawal transaction. */
export function hasNativeTransfer(tx: rpc.Api.GetSuccessfulTransactionResponse, poolId: string, recipient: string): boolean {
  return tx.events.contractEventsXdr.flat().some(event => {
    if (!event.contractId || StrKey.encodeContract(event.contractId.toBytes()) !== nativeAssetId) return false;
    const topics = event.body.v0.topics.map(scValToNative);
    const amount = scValToNative(event.body.v0.data);
    return topics.length >= 3 && topics[0] === 'transfer' && topics[1] === poolId && topics[2] === recipient && BigInt(amount) === BigInt(FIXED_STROOPS);
  });
}
