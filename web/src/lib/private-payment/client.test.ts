import { describe, expect, it } from 'vitest';
import { validateNote, type PrivateNote } from './client';
import { deployment, privatePaymentConfig } from './config';
import { FIELD, fieldHex, mimc7 } from './crypto';

const note = (): PrivateNote => ({
  version: 1, network: 'TESTNET', poolId: deployment.poolId!,
  secret: '1', blinding: '2', commitment: fieldHex(mimc7('1', '2')),
});

describe('Private note recovery validation', () => {
  it('accepts the exact JSON backup format for this pool', () => {
    expect(() => validateNote(JSON.parse(JSON.stringify(note())))).not.toThrow();
  });
  it.each([
    { secret: '0' }, { secret: FIELD.toString() }, { secret: '01' },
    { blinding: '-2' }, { blinding: 'not-a-number' },
    { commitment: '00'.repeat(32) }, { network: 'MAINNET' },
    { poolId: deployment.assetId }, { version: 2 }, { extra: 'untrusted' },
  ])('rejects changed or invalid backup fields: %j', (change) => {
    expect(() => validateNote({ ...note(), ...change } as PrivateNote)).toThrow();
  });
  it('does not confuse a recoverable note with a payment receipt', () => {
    expect(note()).not.toHaveProperty('verified');
    expect(note()).not.toHaveProperty('txHash');
  });
});

describe('Recorded deployment configuration', () => {
  it('is explicitly scoped to the fixed-denomination experimental Testnet pool', () => {
    expect(privatePaymentConfig()).toMatchObject({
      ready: true, network: 'TESTNET', denomination: '1', asset: 'XLM',
      poolId: deployment.poolId, proofSystem: 'Groth16 / BLS12-381',
    });
  });
});
