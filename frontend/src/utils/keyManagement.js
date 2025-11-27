// frontend/src/utils/keyManagement.js
/* eslint-disable no-undef */
import { buildPoseidon } from 'circomlibjs';

/**
 * Monero-Style Key Management for zkUlt
 *
 * Manages view and spend key pairs with localStorage + basic encryption
 */

const FIELD_MODULUS = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const STORAGE_KEY_VIEW_PRIV = 'zkult_view_private_key';
const STORAGE_KEY_SPEND_PRIV = 'zkult_spend_private_key';
const STORAGE_KEY_VIEW_PUB = 'zkult_view_public_key';

let poseidon = null;

/**
 * Initialize Poseidon hasher
 */
async function initPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

/**
 * Generate a random field element
 */
function generateRandomFieldElement() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  let randomBigInt = BigInt(0);
  for (let i = 0; i < 32; i++) {
    randomBigInt = (randomBigInt << BigInt(8)) | BigInt(randomBytes[i]);
  }

  return (randomBigInt % FIELD_MODULUS).toString();
}

/**
 * Derive view public key from view private key
 */
async function deriveViewPublicKey(viewPrivateKey) {
  const p = await initPoseidon();
  const hash = p([BigInt(viewPrivateKey)]);
  return p.F.toString(hash);
}

/**
 * Generate new Monero-style key pair
 *
 * @returns {Object} { viewPrivateKey, viewPublicKey, spendPrivateKey }
 */
export async function generateKeyPair() {
  console.log('🔑 Generating Monero-style key pair...');

  const viewPrivateKey = generateRandomFieldElement();
  const spendPrivateKey = generateRandomFieldElement();
  const viewPublicKey = await deriveViewPublicKey(viewPrivateKey);

  console.log('✅ Key pair generated');
  console.log('   View Public Key:', viewPublicKey.slice(0, 20) + '...');

  return {
    viewPrivateKey,
    viewPublicKey,
    spendPrivateKey
  };
}

/**
 * Save keys to localStorage (with basic obfuscation)
 * Note: This is basic security. For production, consider more robust encryption.
 */
export function saveKeys(viewPrivateKey, spendPrivateKey, viewPublicKey) {
  try {
    // Simple XOR obfuscation (not cryptographically secure, but better than plaintext)
    const obfuscate = (key) => {
      const entropy = window.location.hostname + navigator.userAgent;
      let result = '';
      for (let i = 0; i < key.length; i++) {
        result += String.fromCharCode(
          key.charCodeAt(i) ^ entropy.charCodeAt(i % entropy.length)
        );
      }
      return btoa(result);
    };

    localStorage.setItem(STORAGE_KEY_VIEW_PRIV, obfuscate(viewPrivateKey));
    localStorage.setItem(STORAGE_KEY_SPEND_PRIV, obfuscate(spendPrivateKey));
    localStorage.setItem(STORAGE_KEY_VIEW_PUB, viewPublicKey); // Public key doesn't need obfuscation

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
    const deobfuscate = (encoded) => {
      const entropy = window.location.hostname + navigator.userAgent;
      const obfuscated = atob(encoded);
      let result = '';
      for (let i = 0; i < obfuscated.length; i++) {
        result += String.fromCharCode(
          obfuscated.charCodeAt(i) ^ entropy.charCodeAt(i % entropy.length)
        );
      }
      return result;
    };

    const viewPrivEncoded = localStorage.getItem(STORAGE_KEY_VIEW_PRIV);
    const spendPrivEncoded = localStorage.getItem(STORAGE_KEY_SPEND_PRIV);
    const viewPublicKey = localStorage.getItem(STORAGE_KEY_VIEW_PUB);

    if (!viewPrivEncoded || !spendPrivEncoded || !viewPublicKey) {
      return null;
    }

    return {
      viewPrivateKey: deobfuscate(viewPrivEncoded),
      spendPrivateKey: deobfuscate(spendPrivEncoded),
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
 * Export keys as JSON (for backup)
 */
export function exportKeys() {
  const keys = loadKeys();
  if (!keys) return null;

  return JSON.stringify(keys, null, 2);
}

/**
 * Import keys from JSON backup
 */
export function importKeys(jsonString) {
  try {
    const keys = JSON.parse(jsonString);

    if (!keys.viewPrivateKey || !keys.spendPrivateKey || !keys.viewPublicKey) {
      throw new Error('Invalid key format');
    }

    saveKeys(keys.viewPrivateKey, keys.spendPrivateKey, keys.viewPublicKey);
    console.log('✅ Keys imported successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to import keys:', error);
    return false;
  }
}

/**
 * Derive shared secret (for payment detection)
 */
export async function deriveSharedSecret(viewPrivateKey, ephemeralPublicKey) {
  const p = await initPoseidon();
  // First derive view public key from private key
  const viewPub = p([BigInt(viewPrivateKey)]);
  const viewPubStr = p.F.toString(viewPub);
  // Then derive shared secret: Poseidon(viewPub, ephemeralPub)
  const hash = p([BigInt(viewPubStr), BigInt(ephemeralPublicKey)]);
  return p.F.toString(hash);
}

/**
 * Compute stealth address
 */
export async function computeStealthAddress(sharedSecret, transferAmount, stealthSalt) {
  const p = await initPoseidon();
  const hash = p([
    BigInt(sharedSecret),
    BigInt(transferAmount),
    BigInt(stealthSalt)
  ]);
  return p.F.toString(hash);
}

/**
 * Check if a payment belongs to the user
 */
export async function checkPaymentOwnership(viewPrivateKey, ephemeralPublicKey, stealthAddress, transferAmount, stealthSalt) {
  try {
    const sharedSecret = await deriveSharedSecret(viewPrivateKey, ephemeralPublicKey);
    const computed = await computeStealthAddress(sharedSecret, transferAmount, stealthSalt);
    return computed === stealthAddress;
  } catch (error) {
    console.error('❌ Ownership check failed:', error);
    return false;
  }
}

/**
 * Format key for display (show first 10 and last 10 chars)
 */
export function formatKeyForDisplay(key) {
  if (!key || key.length < 20) return key;
  return `${key.slice(0, 10)}...${key.slice(-10)}`;
}

export default {
  generateKeyPair,
  saveKeys,
  loadKeys,
  hasKeys,
  clearKeys,
  exportKeys,
  importKeys,
  deriveSharedSecret,
  computeStealthAddress,
  checkPaymentOwnership,
  formatKeyForDisplay
};
