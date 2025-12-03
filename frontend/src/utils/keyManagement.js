// frontend/src/utils/keyManagement.js
/* eslint-disable no-undef */
import { buildBabyjub, buildEddsa, buildPoseidon } from 'circomlibjs';

/**
 * Monero-Style Key Management for zkUlt (ECDH Upgrade)
 *
 * Manages view and spend key pairs with localStorage
 */

const FIELD_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const BABYJUB_SUB_ORDER = BigInt('2736030358979909402780800718157159386076813972158567259200215660948447373041');
const STORAGE_KEY_VIEW_PRIV = 'zkult_view_private_key';
const STORAGE_KEY_SPEND_PRIV = 'zkult_spend_private_key';
const STORAGE_KEY_VIEW_PUB = 'zkult_view_public_key';

let babyJub = null;
let eddsa = null;
let poseidon = null;

/**
 * Initialize Crypto Primitives
 */
async function initCrypto() {
  if (!babyJub || !eddsa || !poseidon) {
    babyJub = await buildBabyjub();
    eddsa = await buildEddsa();
    poseidon = await buildPoseidon();
  }
  return { babyJub, eddsa, poseidon, F: babyJub.F };
}

/**
 * Generate a random scalar (private key)
 */
function generateRandomScalar() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return randomBytes; // Return bytes, easier for eddsa
}

/**
 * Derive view public key point [X, Y] from private key scalar
 * CRITICAL: Uses raw BabyJubJub scalar multiplication (NOT EdDSA) to match circuit
 */
async function deriveViewPublicKey(viewPrivateKeyBytes) {
  const { babyJub, F } = await initCrypto();

  // Convert bytes to scalar (mod BABYJUB_SUB_ORDER)
  let privKeyScalar = BigInt(0);
  for (let i = 0; i < 32; i++) {
    privKeyScalar = (privKeyScalar << BigInt(8)) | BigInt(viewPrivateKeyBytes[i]);
  }
  privKeyScalar = privKeyScalar % BABYJUB_SUB_ORDER;

  // BabyJubJub base point (same as in circuits)
  // Must use babyJub.Base8 which is already in the correct field element format
  const basePoint = babyJub.Base8;

  // Raw scalar multiplication: pubKey = privKey × basePoint
  // This matches EscalarMulAny in claim.circom and stealth.circom
  const pubKeyPoint = babyJub.mulPointEscalar(basePoint, privKeyScalar);

  // Convert to string array for storage/display
  return [
    F.toString(pubKeyPoint[0]),
    F.toString(pubKeyPoint[1])
  ];
}

/**
 * Generate new Monero-style key pair
 *
 * @returns {Object} { viewPrivateKey, viewPublicKey, spendPrivateKey }
 */
export async function generateKeyPair() {
  console.log('🔑 Generating Monero-style key pair (ECDH)...');

  const { F } = await initCrypto();

  // View Key
  const viewPrivBytes = generateRandomScalar();
  const viewPublicKey = await deriveViewPublicKey(viewPrivBytes);
  
  // Spend Key (Scalar)
  const spendPrivBytes = generateRandomScalar();
  
  // Convert bytes to BigInt -> String for storage
  // CRITICAL FIX: Use BabyJubJub Subgroup Order for private keys
  // This ensures 0 <= scalar < order, preventing mismatch between JS and Circuit
  let viewPrivBigInt = BigInt(0);
  for (let i = 0; i < 32; i++) {
    viewPrivBigInt = (viewPrivBigInt << BigInt(8)) | BigInt(viewPrivBytes[i]);
  }
  const viewPrivateKey = (viewPrivBigInt % BABYJUB_SUB_ORDER).toString();

  let spendPrivBigInt = BigInt(0);
  for (let i = 0; i < 32; i++) {
    spendPrivBigInt = (spendPrivBigInt << BigInt(8)) | BigInt(spendPrivBytes[i]);
  }
  const spendPrivateKey = (spendPrivBigInt % BABYJUB_SUB_ORDER).toString();

  console.log('✅ Key pair generated');
  console.log('   View Public Key:', viewPublicKey);

  return {
    viewPrivateKey,
    viewPublicKey, // [X, Y] array of strings
    spendPrivateKey
  };
}

/**
 * Save keys to localStorage (Plain text for reliability)
 */
export function saveKeys(viewPrivateKey, spendPrivateKey, viewPublicKey) {
  try {
    localStorage.setItem(STORAGE_KEY_VIEW_PRIV, viewPrivateKey);
    localStorage.setItem(STORAGE_KEY_SPEND_PRIV, spendPrivateKey);
    // Store Public Key as JSON string since it's an array
    localStorage.setItem(STORAGE_KEY_VIEW_PUB, JSON.stringify(viewPublicKey));

    console.log('✅ Keys saved to localStorage');
    return true;
  } catch (error) {
    console.error('❌ Failed to save keys:', error);
    return false;
  }
}

/**
 * Load keys from localStorage
 */
export function loadKeys() {
  try {
    const viewPrivateKey = localStorage.getItem(STORAGE_KEY_VIEW_PRIV);
    const spendPrivateKey = localStorage.getItem(STORAGE_KEY_SPEND_PRIV);
    const viewPubString = localStorage.getItem(STORAGE_KEY_VIEW_PUB);

    if (!viewPrivateKey || !spendPrivateKey || !viewPubString) {
      return null;
    }

    // Handle legacy keys (single string) vs new keys (JSON array)
    let viewPublicKey;
    try {
      viewPublicKey = JSON.parse(viewPubString);
      // If it's not an array (legacy key), treat it as null/invalid to force regeneration
      if (!Array.isArray(viewPublicKey)) {
          console.warn("Legacy key detected, clearing...");
          return null;
      }
    } catch (e) {
      console.warn("Legacy key format detected, clearing...");
      return null;
    }

    return {
      viewPrivateKey: viewPrivateKey,
      spendPrivateKey: spendPrivateKey,
      viewPublicKey: viewPublicKey
    };
  } catch (error) {
    console.error('❌ Failed to load keys:', error);
    return null;
  }
}

/**
 * Check if user has keys stored
 */
export function hasKeys() {
  return localStorage.getItem(STORAGE_KEY_VIEW_PRIV) !== null;
}

/**
 * Clear all stored keys
 */
export function clearKeys() {
  localStorage.removeItem(STORAGE_KEY_VIEW_PRIV);
  localStorage.removeItem(STORAGE_KEY_SPEND_PRIV);
  localStorage.removeItem(STORAGE_KEY_VIEW_PUB);
  console.log('🗑️  Keys cleared from localStorage');
}

/**
 * Derive shared secret (ECDH)
 * sharedSecret = viewPrivateKey * ephemeralPublicKeyPoint
 */
export async function deriveSharedSecret(viewPrivateKey, ephemeralPublicKey) {
  const { babyJub, F } = await initCrypto();
  
  // Convert inputs to correct types
  const privKey = BigInt(viewPrivateKey);
  
  // Verify ephemeral key is a point
  let ephPoint;
  if (Array.isArray(ephemeralPublicKey)) {
      ephPoint = [BigInt(ephemeralPublicKey[0]), BigInt(ephemeralPublicKey[1])];
  } else {
      throw new Error("Ephemeral public key must be [x, y] array");
  }

  // Perform Scalar Multiplication (ECDH)
  // sharedPoint = privKey * ephPoint
  const sharedPoint = babyJub.mulPointEscalar(ephPoint, privKey);
  
  // Use X-coordinate as shared secret
  return F.toString(sharedPoint[0]);
}

/**
 * Compute stealth address
 * stealthAddress = Poseidon(sharedSecret, amount, salt)
 */
export async function computeStealthAddress(sharedSecret, transferAmount, stealthSalt) {
  const { poseidon, F } = await initCrypto();
  const hash = poseidon([
    BigInt(sharedSecret),
    BigInt(transferAmount),
    BigInt(stealthSalt)
  ]);
  return F.toString(hash);
}

export default {
  generateKeyPair,
  saveKeys,
  loadKeys,
  hasKeys,
  clearKeys,
  deriveSharedSecret,
  computeStealthAddress
};