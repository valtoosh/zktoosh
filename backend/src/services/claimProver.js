// backend/src/services/claimProver.js
const snarkjs = require('snarkjs');
const { buildPoseidon } = require('circomlibjs');
const path = require('path');

/**
 * Generate a PLONK proof for claiming a stealth payment (Monero-Style)
 *
 * @param {Object} claimData - Claim input data
 * @param {string} claimData.viewPrivateKey - Recipient's view private key
 * @param {string} claimData.spendPrivateKey - Recipient's spend private key
 * @param {string} claimData.transferAmount - Amount being claimed (discovered via scanning)
 * @param {string} claimData.stealthSalt - Salt used in stealth address generation (discovered via scanning)
 * @param {string} claimData.ephemeralPublicKey - Ephemeral public key from blockchain event
 * @param {string} claimData.assetId - Asset ID
 * @param {string} claimData.stealthAddress - Stealth address to claim from
 *
 * @returns {Object} { proof, publicSignals }
 */
async function generateClaimProof(claimData) {
  console.log('🔐 Generating Monero-style claim proof...');
  console.log('   Stealth Address:', claimData.stealthAddress);
  console.log('   Asset ID:', claimData.assetId);
  console.log('   Transfer Amount:', claimData.transferAmount);
  console.log('   Ephemeral Public Key:', claimData.ephemeralPublicKey?.slice(0, 20) + '...');

  try {
    // Prepare circuit inputs (Monero-style)
    // CRITICAL: Order MUST match claim.circom signal input declarations!
    const input = {
      // Private inputs (Monero-style: view + spend keys)
      viewPrivateKey: claimData.viewPrivateKey,
      spendPrivateKey: claimData.spendPrivateKey,
      ephemeralPublicKey: claimData.ephemeralPublicKey,  // MUST come before transferAmount!
      transferAmount: claimData.transferAmount,
      stealthSalt: claimData.stealthSalt,

      // Public inputs
      assetId: claimData.assetId,
      stealthAddress: claimData.stealthAddress
    };

    console.log('   📝 Circuit inputs prepared');
    console.log('   🔍 DEBUGGING - Input values being passed to circuit:');
    console.log('      viewPrivateKey:', input.viewPrivateKey);
    console.log('      spendPrivateKey:', input.spendPrivateKey);
    console.log('      ephemeralPublicKey:', input.ephemeralPublicKey);
    console.log('      transferAmount:', input.transferAmount);
    console.log('      stealthSalt:', input.stealthSalt);
    console.log('      assetId:', input.assetId);
    console.log('      stealthAddress:', input.stealthAddress);

    // Paths to circuit artifacts
    const wasmPath = path.join(__dirname, '../../../circuits/plonk/claim_build/claim_js/claim.wasm');
    const zkeyPath = path.join(__dirname, '../../../circuits/plonk/claim_build/claim_final.zkey');

    console.log('   ⚙️  Generating witness...');

    // Generate witness
    const { proof, publicSignals } = await snarkjs.plonk.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log('   ✅ Monero-style claim proof generated successfully');
    console.log('   📊 Public Signals (from .sym file - ALREADY in contract order!):');
    console.log('      [0] valid:', publicSignals[0]);
    console.log('      [1] claimerAddressHash:', publicSignals[1]);
    console.log('      [2] claimedAmount:', publicSignals[2]);
    console.log('      [3] assetId:', publicSignals[3]);
    console.log('      [4] stealthAddress:', publicSignals[4]);

    // ============================================
    // NO REORDERING NEEDED!
    // ============================================
    // According to claim.sym file, Circom outputs signals as:
    //   Signal 1: valid
    //   Signal 2: claimerAddressHash
    //   Signal 3: claimedAmount
    //   Signal 4: assetId
    //   Signal 5: stealthAddress
    //
    // This is ALREADY the contract's expected order!
    // Previous reordering was causing the scrambled outputs.

    return {
      proof,
      publicSignals: publicSignals,  // Use as-is, no reordering!
      success: true
    };

  } catch (error) {
    console.error('   ❌ Error generating claim proof:', error);
    throw new Error(`Claim proof generation failed: ${error.message}`);
  }
}

/**
 * Verify a claim proof (for testing)
 */
async function verifyClaimProof(proof, publicSignals) {
  console.log('🔍 Verifying claim proof...');

  try {
    const vKeyPath = path.join(__dirname, '../../../circuits/plonk/claim_build/verification_key.json');
    const vKey = require(vKeyPath);

    const isValid = await snarkjs.plonk.verify(vKey, publicSignals, proof);

    console.log('   Verification result:', isValid ? '✅ Valid' : '❌ Invalid');

    return isValid;
  } catch (error) {
    console.error('   ❌ Verification error:', error);
    return false;
  }
}

module.exports = {
  generateClaimProof,
  verifyClaimProof
};
