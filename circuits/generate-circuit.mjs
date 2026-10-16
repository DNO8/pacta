import { writeFileSync } from 'node:fs';
import { constants, ROUNDS } from './crypto.mjs';
const source = `pragma circom 2.2.3;
// TESTNET EXPERIMENT. MiMC7 over BLS12-381 Fr, 110 rounds, domain-separated SHA256 constants.
// This parameterization has not been independently audited.
template MiMC7() {
 signal input x; signal input k; signal output out;
 var c[${ROUNDS}] = [${constants.join(',')}];
 signal t[${ROUNDS}]; signal t2[${ROUNDS}]; signal t4[${ROUNDS}]; signal t6[${ROUNDS}]; signal r[${ROUNDS}];
 for (var i=0; i<${ROUNDS}; i++) {
  if(i==0) { t[i] <== x+k+c[i]; } else { t[i] <== r[i-1]+k+c[i]; }
  t2[i] <== t[i]*t[i]; t4[i] <== t2[i]*t2[i]; t6[i] <== t4[i]*t2[i]; r[i] <== t6[i]*t[i];
 }
 out <== r[${ROUNDS-1}]+k+x;
}
template PrivatePayment() {
 signal input secret; signal input secretInverse; signal input blinding;
 signal input recipientHi; signal input recipientLo; signal input domainHi; signal input domainLo;
 signal input commitments[4];
 signal output nullifier; signal output spendTag;
 secret * secretInverse === 1;
 component commitment=MiMC7(); commitment.x <== secret; commitment.k <== blinding;
 signal membership[3];
 membership[0] <== (commitment.out-commitments[0])*(commitment.out-commitments[1]);
 membership[1] <== membership[0]*(commitment.out-commitments[2]);
 membership[2] <== membership[1]*(commitment.out-commitments[3]); membership[2] === 0;
 component n1=MiMC7(); n1.x <== secret; n1.k <== domainHi;
 component n2=MiMC7(); n2.x <== n1.out; n2.k <== domainLo; nullifier <== n2.out;
 component r1=MiMC7(); r1.x <== secret; r1.k <== recipientHi;
 component r2=MiMC7(); r2.x <== r1.out; r2.k <== recipientLo; spendTag <== r2.out;
}
component main {public [recipientHi,recipientLo,domainHi,domainLo,commitments]} = PrivatePayment();
`;
writeFileSync(new URL('private_payment.circom',import.meta.url), source);
