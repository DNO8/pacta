// Groth16 equation/parser adapted from CircomStellar, MIT; see THIRD_PARTY_LICENSES.md.
use soroban_sdk::{crypto::bls12_381::{Fr,G1Affine,G2Affine,G1_SERIALIZED_SIZE,G2_SERIALIZED_SIZE},vec,Bytes,Env,Vec};
use crate::Error;
#[derive(Clone)]
struct VerificationKey {
    alpha: G1Affine,
    beta: G2Affine,
    gamma: G2Affine,
    delta: G2Affine,
    ic: Vec<G1Affine>,
}

#[derive(Clone)]
struct Proof {
    a: G1Affine,
    b: G2Affine,
    c: G1Affine,
}

fn take<const N: usize>(
    bytes: &Bytes,
    pos: &mut u32,
    err: Error,
) -> Result<[u8; N], Error> {
    let end = pos.checked_add(N as u32).ok_or(err)?;
    if end > bytes.len() {
        return Err(err);
    }

    let mut arr = [0u8; N];
    bytes.slice(*pos..end).copy_into_slice(&mut arr);
    *pos = end;
    Ok(arr)
}

impl VerificationKey {
    fn from_bytes(env: &Env, bytes: &Bytes) -> Result<Self, Error> {
        let mut pos = 0u32;

        let alpha = G1Affine::from_array(
            env,
            &take::<G1_SERIALIZED_SIZE>(bytes, &mut pos, Error::MalformedKey)?,
        );
        let beta = G2Affine::from_array(
            env,
            &take::<G2_SERIALIZED_SIZE>(bytes, &mut pos, Error::MalformedKey)?,
        );
        let gamma = G2Affine::from_array(
            env,
            &take::<G2_SERIALIZED_SIZE>(bytes, &mut pos, Error::MalformedKey)?,
        );
        let delta = G2Affine::from_array(
            env,
            &take::<G2_SERIALIZED_SIZE>(bytes, &mut pos, Error::MalformedKey)?,
        );

        let ic_len_bytes = take::<4>(bytes, &mut pos, Error::MalformedKey)?;
        let ic_len = u32::from_be_bytes(ic_len_bytes);
        if ic_len != 11 { return Err(Error::MalformedKey); }
        let mut ic = Vec::new(env);

        for _ in 0..ic_len {
            let g1 = G1Affine::from_array(
                env,
                &take::<G1_SERIALIZED_SIZE>(bytes, &mut pos, Error::MalformedKey)?,
            );
            ic.push_back(g1);
        }

        if pos != bytes.len() || ic_len != 11 {
            return Err(Error::MalformedKey);
        }

        Ok(Self {
            alpha,
            beta,
            gamma,
            delta,
            ic,
        })
    }
}

impl Proof {
    fn from_bytes(env: &Env, bytes: &Bytes) -> Result<Self, Error> {
        let mut pos = 0u32;

        let a = G1Affine::from_array(
            env,
            &take::<G1_SERIALIZED_SIZE>(bytes, &mut pos, Error::MalformedProof)?,
        );
        let b = G2Affine::from_array(
            env,
            &take::<G2_SERIALIZED_SIZE>(bytes, &mut pos, Error::MalformedProof)?,
        );
        let c = G1Affine::from_array(
            env,
            &take::<G1_SERIALIZED_SIZE>(bytes, &mut pos, Error::MalformedProof)?,
        );

        if pos != bytes.len() {
            return Err(Error::MalformedProof);
        }

        Ok(Self { a, b, c })
    }
}

fn verify_proof(
    env: &Env,
    vk: VerificationKey,
    proof: Proof,
    pub_signals: Vec<Fr>,
) -> Result<bool, Error> {
    if pub_signals.len() + 1 != vk.ic.len() {
        return Err(Error::MalformedKey);
    }

    let bls = env.crypto().bls12_381();

    let mut vk_x = vk.ic.get(0).unwrap();
    for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
        let prod = bls.g1_mul(&v, &s);
        vk_x = bls.g1_add(&vk_x, &prod);
    }

    let neg_a = -proof.a;
    let vp1 = vec![env, neg_a, vk.alpha, vk_x, proof.c];
    let vp2 = vec![env, proof.b, vk.beta, vk.gamma, vk.delta];

    Ok(bls.pairing_check(vp1, vp2))
}


pub fn validate_key(env:&Env,bytes:&Bytes)->Result<(),Error> {
 let vk=VerificationKey::from_bytes(env,bytes)?;
 if !vk.alpha.is_in_subgroup() || !vk.beta.is_in_subgroup() || !vk.gamma.is_in_subgroup() || !vk.delta.is_in_subgroup() { return Err(Error::MalformedKey); }
 for p in vk.ic.iter() { if !p.is_in_subgroup() { return Err(Error::MalformedKey); } }
 Ok(())
}
pub fn verify(env:&Env,key:&Bytes,proof:&Bytes,signals:Vec<Fr>)->Result<bool,Error> {
 if signals.len()!=10 { return Err(Error::InvalidScalar); }
 let vk=VerificationKey::from_bytes(env,key)?; let p=Proof::from_bytes(env,proof)?;
 // pairing_check validates points and subgroup membership in the host.
 verify_proof(env,vk,p,signals)
}
