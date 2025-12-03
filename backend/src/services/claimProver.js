// backend/src/services/claimProver.js
const snarkjs = require('snarkjs');
const path = require('path');

/**
 * Generate a PLONK proof for claiming a stealth payment (Monero-Style ECDH)
 *
 * @param {Object} claimData - Claim input data
 * @param {string} claimData.viewPrivateKey - Recipient's view private key (Scalar)
 * @param {string} claimData.spendPrivateKey - Recipient's spend private key (Scalar)
 * @param {Array}  claimData.ephemeralPublicKey - Ephemeral public key point [X, Y]
 * @param {string} claimData.transferAmount - Amount being claimed
 * @param {string} claimData.stealthSalt - Salt used in stealth address generation
 * @param {string} claimData.assetId - Asset ID
 * @param {string} claimData.stealthAddress - Stealth address to claim from
 *
 * @returns {Object} { proof, publicSignals }
 */
async function generateClaimProof(claimData) {
  console.log('🔐 Generating Monero-style claim proof (ECDH)...');
  console.log('   Stealth Address:', claimData.stealthAddress);
  console.log('   Ephemeral Public Key:', claimData.ephemeralPublicKey);

  try {
    // Ensure ephemeral key is [x, y]
    if (!Array.isArray(claimData.ephemeralPublicKey) || claimData.ephemeralPublicKey.length !== 2) {
        throw new Error("ephemeralPublicKey must be [x, y] array");
    }

    const input = {
      // Private inputs
      viewPrivateKey: claimData.viewPrivateKey,
      spendPrivateKey: claimData.spendPrivateKey, // Unused in logic but required by interface
      ephemeralPublicKey: claimData.ephemeralPublicKey,  // Now [X, Y]
      transferAmount: claimData.transferAmount,
      stealthSalt: claimData.stealthSalt,

      // Public inputs
      assetId: claimData.assetId,
      stealthAddress: claimData.stealthAddress
    };

    console.log('   📝 Circuit inputs prepared');

    const wasmPath = path.join(__dirname, '../../../circuits/plonk/claim_build/claim_js/claim.wasm');
    const zkeyPath = path.join(__dirname, '../../../circuits/plonk/claim_build/claim_final.zkey');

    console.log('   ⚙️  Generating witness...');

    const { proof, publicSignals } = await snarkjs.plonk.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log('   ✅ Claim proof generated successfully');
    
    // Signal Order (from circuit):
    // [0] valid
    // [1] claimerAddressHash
    // [2] claimedAmount
    // [3] assetId
    // [4] stealthAddress
    
    // Note: While input array size changed for ephemeral key, it is a PRIVATE input.
    // The PUBLIC signals (outputs + public inputs) remain the same count and order in claim.circom.
    // [valid, claimerAddressHash, claimedAmount] (outputs) + [assetId, stealthAddress] (public inputs)
    
    return {
      proof,
      publicSignals: publicSignals, 
      success: true
    };

  } catch (error) {
    console.error('   ❌ Error generating claim proof:', error);
    throw new Error(`Claim proof generation failed: ${error.message}`);
  }
}

async function verifyClaimProof(proof, publicSignals) {
  try {
    const vKeyPath = path.join(__dirname, '../../../circuits/plonk/claim_build/verification_key.json');
    const vKey = require(vKeyPath);
    return await snarkjs.plonk.verify(vKey, publicSignals, proof);
  } catch (error) {
    return false;
  }
}

module.exports = {
  generateClaimProof,
  verifyClaimProof
};