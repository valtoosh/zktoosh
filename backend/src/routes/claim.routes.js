// backend/src/routes/claim.routes.js
const express = require('express');
const router = express.Router();
const { generateClaimProof, verifyClaimProof } = require('../services/claimProver');

/**
 * POST /api/claim/generate-proof
 * Generate a PLONK proof for claiming a stealth payment
 */
router.post('/generate-proof', async (req, res) => {
  try {
    const {
      // MONERO-STYLE: Accept view and spend private keys
      viewPrivateKey,
      spendPrivateKey,
      recipientAddressHash,  // Legacy support
      transferAmount,
      stealthSalt,
      ephemeralPublicKey,
      assetId,
      stealthAddress
    } = req.body;

    // Validate inputs - support both Monero-style and legacy
    const hasMoneroKeys = viewPrivateKey && spendPrivateKey;
    const hasLegacyKey = recipientAddressHash;

    if (!hasMoneroKeys && !hasLegacyKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required keys: provide either (viewPrivateKey + spendPrivateKey) or recipientAddressHash'
      });
    }

    if (!transferAmount || !stealthSalt || !ephemeralPublicKey || !assetId || !stealthAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required claim parameters'
      });
    }

    console.log('📨 Received Monero-style claim proof request');
    console.log('   Stealth Address:', stealthAddress);
    console.log('   Asset ID:', assetId);
    console.log('   Using Monero keys:', hasMoneroKeys);
    console.log('');
    console.log('🔍 FULL REQUEST BODY DEBUG:');
    console.log('   viewPrivateKey:', viewPrivateKey);
    console.log('   spendPrivateKey:', spendPrivateKey);
    console.log('   ephemeralPublicKey:', ephemeralPublicKey);
    console.log('   transferAmount:', transferAmount);
    console.log('   stealthSalt:', stealthSalt);
    console.log('   assetId:', assetId);
    console.log('   stealthAddress:', stealthAddress);
    console.log('');

    // Generate proof with Monero-style keys
    const result = await generateClaimProof({
      viewPrivateKey,
      spendPrivateKey,
      recipientAddressHash: recipientAddressHash || 'monero-style',  // Placeholder for Monero-style
      transferAmount,
      stealthSalt,
      ephemeralPublicKey,
      assetId,
      stealthAddress
    });

    res.json(result);

  } catch (error) {
    console.error('❌ Claim proof generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/claim/format-for-contract
 * Format proof for Solidity contract consumption
 */
router.post('/format-for-contract', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        success: false,
        error: 'Missing proof or publicSignals'
      });
    }

    console.log('📝 Formatting claim proof for contract...');
    console.log('   📊 Public signals (ALREADY in correct contract order):');
    console.log('      [0] valid:', publicSignals[0]);
    console.log('      [1] claimerAddressHash:', publicSignals[1]);
    console.log('      [2] claimedAmount:', publicSignals[2]);
    console.log('      [3] assetId:', publicSignals[3]);
    console.log('      [4] stealthAddress:', publicSignals[4]);

    // ============================================
    // NO REORDERING - Circom outputs in contract order!
    // ============================================
    // According to claim.sym file, Circom already outputs signals as:
    //   [0]: valid
    //   [1]: claimerAddressHash
    //   [2]: claimedAmount
    //   [3]: assetId
    //   [4]: stealthAddress
    //
    // This matches the contract's expected order exactly!

    // Extract proof elements (PLONK proof has specific structure)
    const proofCalldata = await require('snarkjs').plonk.exportSolidityCallData(proof, publicSignals);

    // Parse the calldata
    // Format: ["0xproof1","0xproof2",...]["0xsignal1","0xsignal2",...]
    // Note: No comma between the two arrays!
    const separatorIndex = proofCalldata.indexOf('][');

    if (separatorIndex === -1) {
      throw new Error('Invalid proof calldata format');
    }

    const proofArray = proofCalldata.substring(0, separatorIndex + 1);
    const publicSignalsArray = proofCalldata.substring(separatorIndex + 1);

    // Parse arrays
    const proofElements = JSON.parse(proofArray);
    const publicSignalElements = JSON.parse(publicSignalsArray);

    console.log('   ✅ Proof formatted successfully');
    console.log('   📊 Proof elements:', proofElements.length);
    console.log('   📊 Public signals:', publicSignalElements.length);

    res.json({
      success: true,
      proof: proofElements,
      publicSignals: publicSignalElements
    });

  } catch (error) {
    console.error('❌ Proof formatting error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/claim/verify
 * Verify a claim proof (for testing)
 */
router.post('/verify', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        success: false,
        error: 'Missing proof or publicSignals'
      });
    }

    console.log('🔍 Verifying claim proof...');

    const isValid = await verifyClaimProof(proof, publicSignals);

    res.json({
      success: true,
      valid: isValid
    });

  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
