import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {groth16} from 'snarkjs';
import {createNote,noteWitness,noteSignals,addressContext,proofToHex,verificationKeyToHex} from './crypto.mjs';
const require=createRequire(new URL('../web/package.json',import.meta.url));const {Address,Keypair,StrKey}=require('@stellar/stellar-sdk');
const poolId=StrKey.encodeContract(Buffer.alloc(32,9)),recipient=StrKey.encodeContract(Buffer.alloc(32,8));
const notes=Array.from({length:4},()=>createNote());
const witness=noteWitness(notes[0],notes.map(n=>n.commitment),addressContext(new Address(recipient).toScVal().toXdr()),addressContext(new Address(poolId).toScVal().toXdr()));
const vk=JSON.parse(await readFile('build/verification_key.json','utf8'));
const {proof,publicSignals}=await groth16.fullProve(witness,'build/private_payment_js/private_payment.wasm','build/private_payment.zkey');
assert.deepEqual(publicSignals,noteSignals(witness));assert(await groth16.verify(vk,publicSignals,proof));
for(const index of [0,2,4,6]){const changed=[...publicSignals];changed[index]=(BigInt(changed[index])+1n).toString();assert.equal(await groth16.verify(vk,changed,proof),false);}
await writeFile('build/host-fixture.json',JSON.stringify({vkHex:verificationKeyToHex(vk),proofHex:proofToHex(proof),publicSignals,poolId,recipient},null,2));
console.log('PASS genuine proof, nullifier/recipient/domain/membership tamper rejection');process.exit(0);
