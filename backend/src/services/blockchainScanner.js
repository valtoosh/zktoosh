// backend/src/services/blockchainScanner.js
const { buildPoseidon } = require('circomlibjs');
const ethers = require('ethers');

/**
 * Monero-Style Blockchain Scanner Service
 *
 * Allows recipients to detect incoming stealth payments by:
 * 1. Monitoring blockchain events for new transfers
 * 2. Using view private key to derive shared secrets
 * 3. Testing if stealth addresses match
 * 4. Decrypting payment details from encrypted memos
 *
 * Privacy Properties:
 * - View key can be shared with third-party scanners
 * - Spend key stays secret (only needed for claiming)
 * - Scanning doesn't reveal which payments belong to user
 */
class BlockchainScanner {
  constructor() {
    this.poseidon = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    this.poseidon = await buildPoseidon();
    this.initialized = true;

    console.log('✅ Blockchain scanner initialized');
  }

  /**
   * Derive shared secret using view private key
   *
   * @param {string} viewPrivateKey - Recipient's view private key
   * @param {string} ephemeralPublicKey - From blockchain event
   * @returns {string} Shared secret
   */
  async deriveSharedSecret(viewPrivateKey, ephemeralPublicKey) {
    await this.initialize();

    try {
      const hash = this.poseidon([BigInt(viewPrivateKey), BigInt(ephemeralPublicKey)]);
      return this.poseidon.F.toString(hash);
    } catch (error) {
      console.error('❌ Failed to derive shared secret:', error.message);
      throw error;
    }
  }

  /**
   * Compute stealth address from shared secret
   *
   * @param {string} sharedSecret - Derived shared secret
   * @param {string} transferAmount - Transfer amount
   * @param {string} stealthSalt - Stealth salt
   * @returns {string} Computed stealth address
   */
  async computeStealthAddress(sharedSecret, transferAmount, stealthSalt) {
    await this.initialize();

    try {
      const hash = this.poseidon([
        BigInt(sharedSecret),
        BigInt(transferAmount),
        BigInt(stealthSalt)
      ]);
      return this.poseidon.F.toString(hash);
    } catch (error) {
      console.error('❌ Failed to compute stealth address:', error.message);
      throw error;
    }
  }

  /**
   * Check if a stealth address belongs to the user
   *
   * @param {string} viewPrivateKey - Recipient's view private key
   * @param {string} ephemeralPublicKey - From blockchain
   * @param {string} stealthAddress - On-chain stealth address
   * @param {string} transferAmount - Decrypted or guessed amount
   * @param {string} stealthSalt - Decrypted or guessed salt
   * @returns {boolean} True if payment belongs to user
   */
  async checkOwnership(viewPrivateKey, ephemeralPublicKey, stealthAddress, transferAmount, stealthSalt) {
    await this.initialize();

    try {
      // Step 1: Derive shared secret
      const sharedSecret = await this.deriveSharedSecret(viewPrivateKey, ephemeralPublicKey);

      // Step 2: Compute expected stealth address
      const computed = await this.computeStealthAddress(sharedSecret, transferAmount, stealthSalt);

      // Step 3: Compare
      return computed === stealthAddress;
    } catch (error) {
      console.error('❌ Ownership check failed:', error.message);
      return false;
    }
  }

  /**
   * Decrypt encrypted memo using shared secret
   *
   * In a full implementation, this would use the shared secret to decrypt
   * the memo containing transferAmount and stealthSalt.
   *
   * For now, this is a placeholder. Full encryption will be:
   * encryptedAmount = transferAmount XOR Poseidon(sharedSecret, "amount")
   * encryptedSalt = stealthSalt XOR Poseidon(sharedSecret, "salt")
   *
   * @param {string} sharedSecret - Derived shared secret
   * @param {Array} encryptedMemo - [encryptedAmount, encryptedSalt]
   * @returns {Object} { transferAmount, stealthSalt }
   */
  async decryptMemo(sharedSecret, encryptedMemo) {
    await this.initialize();

    try {
      // Generate decryption keys from shared secret
      const amountKey = this.poseidon([BigInt(sharedSecret), BigInt(1)]); // 1 for "amount"
      const saltKey = this.poseidon([BigInt(sharedSecret), BigInt(2)]); // 2 for "salt"

      // XOR to decrypt (in field arithmetic, this is addition/subtraction)
      const amountKeyBigInt = BigInt(this.poseidon.F.toString(amountKey));
      const saltKeyBigInt = BigInt(this.poseidon.F.toString(saltKey));

      const transferAmount = (BigInt(encryptedMemo[0]) + amountKeyBigInt) % this.poseidon.F.p;
      const stealthSalt = (BigInt(encryptedMemo[1]) + saltKeyBigInt) % this.poseidon.F.p;

      return {
        transferAmount: transferAmount.toString(),
        stealthSalt: stealthSalt.toString()
      };
    } catch (error) {
      console.error('❌ Memo decryption failed:', error.message);
      throw error;
    }
  }

  /**
   * Scan blockchain for incoming payments
   *
   * @param {string} viewPrivateKey - Recipient's view private key
   * @param {Array} transfers - Array of transfer events from blockchain
   * @returns {Array} Detected payments with decrypted details
   */
  async scanForPayments(viewPrivateKey, transfers) {
    await this.initialize();

    console.log(`🔍 Scanning ${transfers.length} transfers for incoming payments...`);

    const detectedPayments = [];

    for (const transfer of transfers) {
      try {
        // Derive shared secret from ephemeral public key
        const sharedSecret = await this.deriveSharedSecret(
          viewPrivateKey,
          transfer.ephemeralPublicKey
        );

        // Try to decrypt memo
        let transferAmount, stealthSalt;

        if (transfer.encryptedMemo && transfer.encryptedMemo.length === 2) {
          // Decrypt memo to get amount and salt
          const decrypted = await this.decryptMemo(sharedSecret, transfer.encryptedMemo);
          transferAmount = decrypted.transferAmount;
          stealthSalt = decrypted.stealthSalt;
        } else {
          // No encrypted memo - skip this transfer
          // In production, we might try brute force for common amounts
          continue;
        }

        // Compute expected stealth address
        const computedStealthAddress = await this.computeStealthAddress(
          sharedSecret,
          transferAmount,
          stealthSalt
        );

        // Check if it matches the on-chain stealth address
        if (computedStealthAddress === transfer.stealthAddress) {
          console.log('   ✅ Found payment for this user!');
          console.log('      Stealth Address:', transfer.stealthAddress.slice(0, 20) + '...');
          console.log('      Amount:', transferAmount);

          detectedPayments.push({
            stealthAddress: transfer.stealthAddress,
            ephemeralPublicKey: transfer.ephemeralPublicKey,
            transferAmount,
            stealthSalt,
            assetId: transfer.assetId,
            blockNumber: transfer.blockNumber,
            transactionHash: transfer.transactionHash,
            timestamp: transfer.timestamp
          });
        }
      } catch (error) {
        // Silently skip transfers that fail to decrypt
        // This is expected for transfers not meant for this user
        continue;
      }
    }

    console.log(`✅ Scan complete: found ${detectedPayments.length} payments`);

    return detectedPayments;
  }

  /**
   * Generate view public key from view private key
   *
   * @param {string} viewPrivateKey - View private key
   * @returns {string} View public key (to share as "address")
   */
  async generateViewPublicKey(viewPrivateKey) {
    await this.initialize();

    try {
      // In Monero-style, viewPubKey = Hash(viewPrivateKey)
      // This is a simplified version - full ECC would use scalar multiplication
      const hash = this.poseidon([BigInt(viewPrivateKey)]);
      return this.poseidon.F.toString(hash);
    } catch (error) {
      console.error('❌ Failed to generate view public key:', error.message);
      throw error;
    }
  }

  /**
   * Generate a new Monero-style key pair
   *
   * @returns {Object} { viewPrivateKey, viewPublicKey, spendPrivateKey, spendPublicKey }
   */
  async generateMoneroStyleKeys() {
    await this.initialize();

    const crypto = require('crypto');
    const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

    // Generate view private key
    const viewPrivBytes = crypto.randomBytes(32);
    const viewPrivateKey = (BigInt('0x' + viewPrivBytes.toString('hex')) % fieldModulus).toString();

    // Generate spend private key
    const spendPrivBytes = crypto.randomBytes(32);
    const spendPrivateKey = (BigInt('0x' + spendPrivBytes.toString('hex')) % fieldModulus).toString();

    // Derive public keys
    const viewPublicKey = await this.generateViewPublicKey(viewPrivateKey);

    // Spend public key (for now, just hash of spend private key)
    const spendPubHash = this.poseidon([BigInt(spendPrivateKey)]);
    const spendPublicKey = this.poseidon.F.toString(spendPubHash);

    console.log('🔑 Generated Monero-style key pair:');
    console.log('   View Private Key:', viewPrivateKey.slice(0, 20) + '...');
    console.log('   View Public Key:', viewPublicKey.slice(0, 20) + '...');
    console.log('   Spend Private Key:', spendPrivateKey.slice(0, 20) + '...');
    console.log('   Spend Public Key:', spendPublicKey.slice(0, 20) + '...');

    return {
      viewPrivateKey,
      viewPublicKey,
      spendPrivateKey,
      spendPublicKey
    };
  }
}

module.exports = new BlockchainScanner();
