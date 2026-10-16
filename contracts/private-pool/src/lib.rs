#![no_std]
//! Experimental fixed-denomination BLS12-381 privacy pool. TESTNET ONLY.
//! Groth16 verification equation adapted from jamesbachini/CircomStellar (MIT).
//! There is deliberately no administrator, key setter, upgrade, or emergency withdrawal.
mod verifier;
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, token, xdr::ToXdr, Address, Bytes, BytesN, Env, Vec, U256};

const DENOMINATION: i128 = 10_000_000;
const TTL: u32 = 1_036_800; // roughly 60 days, subject to network max TTL
const THRESHOLD: u32 = 518_400;
const FR_MODULUS: [u8; 32] = [0x73,0xed,0xa7,0x53,0x29,0x9d,0x7d,0x48,0x33,0x39,0xd8,0x08,0x09,0xa1,0xd8,0x05,0x53,0xbd,0xa4,0x02,0xff,0xfe,0x5b,0xfe,0xff,0xff,0xff,0xff,0x00,0x00,0x00,0x01];

#[contracterror]
#[derive(Copy,Clone,Debug,Eq,PartialEq,PartialOrd,Ord)]
#[repr(u32)]
pub enum Error { WrongNetwork=1, WrongToken=2, MalformedKey=3, MalformedProof=4, InvalidScalar=5, DuplicateCommitment=6, BatchNotReady=7, AlreadySpent=8, InvalidProof=9, MissingConfig=10, BatchOverflow=11 }
#[contracttype]
#[derive(Clone)]
pub struct Config { pub token: Address, pub denomination: i128, pub current_batch: u32 }
#[contracttype]
#[derive(Clone)]
pub struct Batch { pub commitments: Vec<BytesN<32>>, pub root: Option<BytesN<32>> }
#[contracttype]
#[derive(Clone)]
enum Key { Config, Vk, Batch(u32), Commitment(BytesN<32>), Spent(BytesN<32>) }

fn touch(env:&Env) { env.storage().instance().extend_ttl(THRESHOLD, TTL); }
fn extend(env:&Env,key:&Key) { env.storage().persistent().extend_ttl(key,THRESHOLD,TTL); }
fn config(env:&Env)->Result<Config,Error> { env.storage().instance().get(&Key::Config).ok_or(Error::MissingConfig) }
fn scalar(env:&Env, b:&BytesN<32>)->Result<soroban_sdk::crypto::bls12_381::Fr,Error> {
 // Canonical encoding is critical: reduction modulo Fr would permit alternate nullifier storage keys.
 if b.to_array() >= FR_MODULUS { return Err(Error::InvalidScalar); }
 Ok(soroban_sdk::crypto::bls12_381::Fr::from_u256(U256::from_be_bytes(env,&b.clone().into())))
}
fn address_limbs(env:&Env,address:&Address)->[soroban_sdk::crypto::bls12_381::Fr;2] {
 let h=env.crypto().sha256(&address.clone().to_xdr(env)).to_array();
 let mut hi=[0u8;32]; let mut lo=[0u8;32]; hi[16..].copy_from_slice(&h[..16]); lo[16..].copy_from_slice(&h[16..]);
 [scalar(env,&BytesN::from_array(env,&hi)).unwrap(),scalar(env,&BytesN::from_array(env,&lo)).unwrap()]
}
fn get_batch(env:&Env,batch:u32)->Batch { env.storage().persistent().get(&Key::Batch(batch)).unwrap_or(Batch {commitments:Vec::new(env),root:None}) }

#[contract]
pub struct PrivatePool;
#[contractimpl]
impl PrivatePool {
 pub fn __constructor(env:Env,token:Address,vk:Bytes)->Result<(),Error> {
  let testnet=env.crypto().sha256(&Bytes::from_slice(&env,b"Test SDF Network ; September 2015"));
  if env.ledger().network_id()!=testnet.to_bytes() { return Err(Error::WrongNetwork); }
  let native=env.deployer().with_stellar_asset(Bytes::from_array(&env,&[0,0,0,0])).deployed_address();
  if token!=native { return Err(Error::WrongToken); }
  verifier::validate_key(&env,&vk)?;
  env.storage().instance().set(&Key::Vk,&vk);
  env.storage().instance().set(&Key::Config,&Config {token,denomination:DENOMINATION,current_batch:0});
  touch(&env); Ok(())
 }
 pub fn config(env:Env)->Result<Config,Error> { config(&env) }
 pub fn snapshot(env:Env,batch:u32)->Batch { get_batch(&env,batch) }
 pub fn find_commitment(env:Env,commitment:BytesN<32>)->Option<u32> { env.storage().persistent().get(&Key::Commitment(commitment)) }
 pub fn is_spent(env:Env,nullifier:BytesN<32>)->bool { env.storage().persistent().has(&Key::Spent(nullifier)) }
 pub fn deposit(env:Env,from:Address,commitment:BytesN<32>)->Result<u32,Error> {
  from.require_auth();
  scalar(&env,&commitment)?;
  if commitment==BytesN::from_array(&env,&[0u8;32]) { return Err(Error::InvalidScalar); }
  let ck=Key::Commitment(commitment.clone());
  if env.storage().persistent().has(&ck) { return Err(Error::DuplicateCommitment); }
  let mut cfg=config(&env)?; let id=cfg.current_batch; let mut batch=get_batch(&env,id);
  if batch.commitments.len()>=4 { return Err(Error::BatchNotReady); }
  token::Client::new(&env,&cfg.token).transfer(&from,&env.current_contract_address(),&DENOMINATION);
  batch.commitments.push_back(commitment.clone());
  if batch.commitments.len()==4 {
   let mut bytes=Bytes::new(&env); for c in batch.commitments.iter() { bytes.append(&c.into()); }
   batch.root=Some(env.crypto().sha256(&bytes).to_bytes());
   cfg.current_batch=cfg.current_batch.checked_add(1).ok_or(Error::BatchOverflow)?;
   env.storage().instance().set(&Key::Config,&cfg);
  }
  let bk=Key::Batch(id); env.storage().persistent().set(&bk,&batch); extend(&env,&bk);
  env.storage().persistent().set(&ck,&id); extend(&env,&ck); touch(&env);
  env.events().publish((symbol_short!("deposit"),id),commitment);
  Ok(id)
 }
 pub fn withdraw(env:Env,batch:u32,recipient:Address,nullifier:BytesN<32>,spend_tag:BytesN<32>,proof:Bytes)->Result<BytesN<32>,Error> {
  let n=scalar(&env,&nullifier)?; let tag=scalar(&env,&spend_tag)?;
  let spent=Key::Spent(nullifier.clone());
  // Persistent archived entries cannot be silently read as absent: the host requires restore.
  if env.storage().persistent().has(&spent) { return Err(Error::AlreadySpent); }
  let funded=get_batch(&env,batch); let root=funded.root.ok_or(Error::BatchNotReady)?;
  if funded.commitments.len()!=4 { return Err(Error::BatchNotReady); }
  let r=address_limbs(&env,&recipient); let d=address_limbs(&env,&env.current_contract_address());
  let mut signals=Vec::new(&env); signals.push_back(n); signals.push_back(tag);
  signals.push_back(r[0].clone()); signals.push_back(r[1].clone()); signals.push_back(d[0].clone()); signals.push_back(d[1].clone());
  for c in funded.commitments.iter() { signals.push_back(scalar(&env,&c)?); }
  let vk:Bytes=env.storage().instance().get(&Key::Vk).ok_or(Error::MissingConfig)?;
  if !verifier::verify(&env,&vk,&proof,signals)? { return Err(Error::InvalidProof); }
  // Consume before transfer. Soroban atomically rolls this back if the transfer fails.
  env.storage().persistent().set(&spent,&true); extend(&env,&spent); extend(&env,&Key::Batch(batch)); touch(&env);
  let cfg=config(&env)?;
  token::Client::new(&env,&cfg.token).transfer(&env.current_contract_address(),&recipient,&DENOMINATION);
  env.events().publish((symbol_short!("withdraw"),root.clone()),(nullifier,recipient));
  Ok(root)
 }
}
#[cfg(test)] mod test;
