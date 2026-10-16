import rawDeployment from './deployment.json';
export interface Deployment {
  schema: number; network: string; networkPassphrase: string; rpcUrl: string;
  poolId: string | null; assetId: string | null; denominationStroops: string; proofSystem: string;
  wasmSha256: string | null; zkeySha256: string | null; verificationKeySha256: string | null;
  deploymentTx: string | null; integrationVerifiedAt: string | null; readerAccount: string | null;
}
export const deployment: Deployment = rawDeployment;

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
export const TESTNET_RPC = 'https://soroban-testnet.stellar.org';
export const FIXED_STROOPS = '10000000';
export const PRIVATE_PAYMENT_NOTICE = 'Prototipo experimental sin auditoría. Solo XLM de prueba. El monto, las cuentas y los tiempos son públicos; la prueba oculta qué nota del grupo se consume.';

export interface PrivatePaymentConfig {
  ready: boolean;
  network: 'TESTNET';
  denomination: '1';
  asset: 'XLM';
  poolId: string | null;
  reason: string;
  proofSystem: string;
}

/** No environment-variable switch can turn an unverified deployment into a payment. */
export function privatePaymentConfig(): PrivatePaymentConfig {
  const ready = deployment.network === 'TESTNET'
    && deployment.networkPassphrase === TESTNET_PASSPHRASE
    && deployment.rpcUrl === TESTNET_RPC
    && deployment.denominationStroops === FIXED_STROOPS
    && /^C[A-Z2-7]{55}$/.test(deployment.poolId ?? '')
    && /^C[A-Z2-7]{55}$/.test(deployment.assetId ?? '')
    && /^G[A-Z2-7]{55}$/.test(deployment.readerAccount ?? '')
    && [deployment.wasmSha256, deployment.zkeySha256, deployment.verificationKeySha256, deployment.deploymentTx].every(x => /^[a-f0-9]{64}$/.test(x ?? ''))
    && Boolean(deployment.integrationVerifiedAt);
  return { ready, network: 'TESTNET', denomination: '1', asset: 'XLM', poolId: deployment.poolId, proofSystem: deployment.proofSystem,
    reason: ready ? 'Despliegue testnet con prueba y retiro comprobados. Experimental, sin auditoría.' : 'El circuito y el pool todavía no tienen un despliegue testnet verificado. No se aceptan depósitos ni se muestran pagos como realizados.' };
}

export function requirePrivatePaymentReady(): typeof deployment {
  if (!privatePaymentConfig().ready) throw new Error(privatePaymentConfig().reason);
  return deployment;
}
