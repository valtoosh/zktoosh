// frontend/src/utils/enaStorage.js
// PHASE 5A: ENA (Encrypted Account) key management utility

const ENA_KEY_PREFIX = 'zkult_kENA_';
const ENA_BALANCE_PREFIX = 'zkult_ena_balance_';
const ENA_SCT_PREFIX = 'zkult_sct_';

/**
 * Get kENA key for a specific account
 * @param {string} address - Ethereum address
 * @returns {string|null} kENA key or null if not found
 */
export const getENAKey = (address) => {
  if (!address) return null;
  const key = localStorage.getItem(`${ENA_KEY_PREFIX}${address.toLowerCase()}`);
  return key;
};

/**
 * Store kENA key for a specific account
 * @param {string} address - Ethereum address
 * @param {string} kENA - ENA encryption key
 */
export const setENAKey = (address, kENA) => {
  if (!address || !kENA) return;
  localStorage.setItem(`${ENA_KEY_PREFIX}${address.toLowerCase()}`, kENA);
};

/**
 * Get encrypted balance (sct) for a specific account
 * @param {string} address - Ethereum address
 * @returns {string|null} sct or null if not found
 */
export const getEncryptedBalance = (address) => {
  if (!address) return null;
  return localStorage.getItem(`${ENA_SCT_PREFIX}${address.toLowerCase()}`);
};

/**
 * Store encrypted balance (sct) for a specific account
 * @param {string} address - Ethereum address
 * @param {string} sct - Encrypted balance
 */
export const setEncryptedBalance = (address, sct) => {
  if (!address || !sct) return;
  localStorage.setItem(`${ENA_SCT_PREFIX}${address.toLowerCase()}`, sct);
};

/**
 * Get local ENA balance (decrypted, for display)
 * @param {string} address - Ethereum address
 * @returns {number|null} ENA balance or null
 */
export const getLocalENABalance = (address) => {
  if (!address) return null;
  const balance = localStorage.getItem(`${ENA_BALANCE_PREFIX}${address.toLowerCase()}`);
  return balance ? parseInt(balance) : null;
};

/**
 * Store local ENA balance (decrypted, for display)
 * @param {string} address - Ethereum address
 * @param {number} balance - ENA balance
 */
export const setLocalENABalance = (address, balance) => {
  if (!address || balance === undefined || balance === null) return;
  localStorage.setItem(`${ENA_BALANCE_PREFIX}${address.toLowerCase()}`, balance.toString());
};

/**
 * Initialize ENA account for a new user
 * @param {string} address - Ethereum address
 * @param {string} kENA - ENA encryption key
 * @param {number} initialBalance - Initial ENA balance (usually 0)
 */
export const initializeENAAccount = (address, kENA, initialBalance = 0) => {
  setENAKey(address, kENA);
  setLocalENABalance(address, initialBalance);
};

/**
 * Clear all ENA data for an account (use with caution!)
 * @param {string} address - Ethereum address
 */
export const clearENAData = (address) => {
  if (!address) return;
  const lowerAddress = address.toLowerCase();
  localStorage.removeItem(`${ENA_KEY_PREFIX}${lowerAddress}`);
  localStorage.removeItem(`${ENA_BALANCE_PREFIX}${lowerAddress}`);
  localStorage.removeItem(`${ENA_SCT_PREFIX}${lowerAddress}`);
};

/**
 * Check if account has ENA initialized
 * @param {string} address - Ethereum address
 * @returns {boolean}
 */
export const hasENAAccount = (address) => {
  if (!address) return false;
  return getENAKey(address) !== null;
};
