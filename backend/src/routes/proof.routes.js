// backend/src/routes/proof.routes.js
const snarkjs = require('snarkjs');
const express = require('express');
const router = express.Router();
const plonkProver = require('../services/plonkProver');
const { proofGenerationLimiter } = require('../middleware/rateLimiter'); // PHASE 4: Rate limiting

/**
 * POST /api/proof/generate
 * Generate a PLONK proof for transfer
 * PHASE 4: Rate limited to 10 requests/minute per IP
 */
router.post('/generate', proofGenerationLimiter, async (req, res) => {
  try {
    const {
      senderBalance,
      transferAmount,
      recipientAddress,
      assetId,
      maxAmount,
      salt,
      // PHASE 5A: Dual Account Model fields
      vPubIn,
      vPubOut,
      kENA,
      sctOld,
      balanceCommitment
    } = req.body;

    // PHASE 5A: Updated validation - check for undefined/null, not falsiness
    // This allows transferAmount = 0 for deposit/withdrawal transactions
    if (senderBalance === undefined || senderBalance === null ||
        transferAmount === undefined || transferAmount === null ||
        !recipientAddress ||
        assetId === undefined || assetId === null ||
        maxAmount === undefined || maxAmount === null) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['senderBalance', 'transferAmount', 'recipientAddress', 'assetId', 'maxAmount']
      });
    }

    // Convert to proper types and include Phase 5A fields
    const input = {
      senderBalance: Number(senderBalance),
      transferAmount: Number(transferAmount),
      recipientAddress: String(recipientAddress),
      assetId: Number(assetId),
      maxAmount: Number(maxAmount),
      salt: salt, // PHASE 4: Optional salt (secure random generated if not provided)
      // PHASE 5A: Dual Account Model parameters
      vPubIn: vPubIn !== undefined ? Number(vPubIn) : undefined,
      vPubOut: vPubOut !== undefined ? Number(vPubOut) : undefined,
      kENA: kENA,
      sctOld: sctOld,
      balanceCommitment: balanceCommitment
    };

    console.log('\n📥 Received Phase 5A proof generation request');
    console.log('   Sender Balance (ENA):', input.senderBalance);
    console.log('   Transfer Amount:', input.transferAmount);
    console.log('   Recipient:', input.recipientAddress);
    console.log('   Asset ID:', input.assetId);
    console.log('   vPubIn (EOA → ENA):', input.vPubIn || 0);
    console.log('   vPubOut (ENA → EOA):', input.vPubOut || 0);

    // Generate proof
    const result = await plonkProver.generateProof(input);

    // Verify proof off-chain before returning
    const isValid = await plonkProver.verifyProof(result.proof, result.publicSignals);

    if (!isValid) {
      return res.status(500).json({
        error: 'Generated proof failed verification',
        details: 'This should not happen. Please check circuit constraints.'
      });
    }

    console.log('📤 Sending Phase 5A proof to frontend\n');

    res.json({
      success: true,
      proof: result.proof,
      publicSignals: result.publicSignals,
      proofSystem: 'plonk',
      generationTime: result.generationTime,
      valid: result.valid,
      newBalance: result.newBalance,
      recipientHash: result.recipientHash,
      recipientAddress: result.recipientAddress,
      // PHASE 4+5A: Return additional fields for frontend storage
      nullifier: result.nullifier, // PHASE 4: For replay protection
      salt: result.salt, // PHASE 4: For frontend storage
      kENA: result.kENA, // PHASE 5A: Encryption key for frontend storage
      sctNew: result.sctNew, // PHASE 5A: New encrypted balance
      vPubDelta: result.vPubDelta, // PHASE 5A: Net public transfer
      stats: result.stats
    });

  } catch (error) {
    console.error('❌ Proof generation error:', error);
    res.status(500).json({
      error: 'Proof generation failed',
      message: error.message
    });
  }
});

/**
 * POST /api/proof/format-for-contract
 * Format proof for Solidity contract submission
 */
router.post('/format-for-contract', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing proof or publicSignals'
      });
    }

    console.log('\n📝 Formatting proof for contract...');
    console.log('📊 Input proof keys:', Object.keys(proof));
    console.log('📊 Input publicSignals length:', publicSignals.length);

    // Use snarkjs to export proper Solidity calldata
    const calldata = await snarkjs.plonk.exportSolidityCallData(
      proof,
      publicSignals
    );

    console.log('\n📦 Raw calldata type:', typeof calldata);
    console.log('📦 Raw calldata length:', calldata.length);
    console.log('📦 First 200 chars:', calldata.substring(0, 200));
    console.log('📦 Last 200 chars:', calldata.substring(calldata.length - 200));

    // Convert to string if it's not already
    const calldataStr = calldata.toString().trim();

    // snarkjs.plonk.exportSolidityCallData returns: [proofArray][signalsArray]
    // Note: NO comma between the arrays! Format is: ["0x...","0x..."]["0x...","0x..."]
    let proofBytes, publicSignalsArray;

    console.log('🔍 Parsing calldata format...');

    try {
      // Find the "][" separator
      const separatorIndex = calldataStr.indexOf('][');

      if (separatorIndex === -1) {
        throw new Error('Could not find ][ separator in calldata');
      }

      // Parse proof array (everything up to and including the first ])
      const proofArrayStr = calldataStr.substring(0, separatorIndex + 1);
      const proofArray = JSON.parse(proofArrayStr);

      // Parse signals array (everything from the second [ onwards)
      const signalsArrayStr = calldataStr.substring(separatorIndex + 1);
      publicSignalsArray = JSON.parse(signalsArrayStr);

      // Keep proof as array for PlonkVerifier contract
      // PlonkVerifier expects uint256[24] not bytes
      proofBytes = proofArray; // Keep as array

      console.log('✅ Parsed successfully');
      console.log('   Proof parts:', proofArray.length);
      console.log('   Proof array:', proofArray);
      console.log('   Signals count:', publicSignalsArray.length);
    } catch (parseError) {
      console.error('❌ Failed to parse calldata:', parseError.message);
      // Return error with debug info
      proofBytes = null;
      publicSignalsArray = null;
    }

    if (!proofBytes || !publicSignalsArray) {
      // Return the raw calldata for inspection
      return res.status(500).json({
        error: 'Could not parse calldata',
        debug: {
          calldataType: typeof calldata,
          calldataLength: calldata.length,
          first200: calldata.substring(0, 200),
          last200: calldata.substring(calldata.length - 200)
        }
      });
    }

    console.log('✅ Proof bytes type:', typeof proofBytes);
    console.log('✅ Public signals count:', publicSignalsArray.length);
    console.log('✅ Public signals:', publicSignalsArray);
    console.log('📤 Sending formatted proof to frontend\n');

    res.json({
      success: true,
      proofBytes: proofBytes,
      publicSignals: publicSignalsArray
    });

  } catch (error) {
    console.error('❌ Proof formatting error:', error);
    res.status(500).json({
      error: 'Proof formatting failed',
      message: error.message,
      stack: error.stack
    });
  }
});

/**
 * POST /api/proof/verify
 * Verify a PLONK proof off-chain
 */
router.post('/verify', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing proof or publicSignals'
      });
    }

    const isValid = await plonkProver.verifyProof(proof, publicSignals);

    res.json({
      valid: isValid,
      publicSignals: publicSignals
    });

  } catch (error) {
    console.error('❌ Proof verification error:', error);
    res.status(500).json({
      error: 'Proof verification failed',
      message: error.message
    });
  }
});

/**
 * GET /api/proof/stats
 * Get proof generation statistics
 */
router.get('/stats', (req, res) => {
  const stats = plonkProver.getStats();
  res.json(stats);
});

/**
 * POST /api/proof/stats/reset
 * Reset statistics
 */
router.post('/stats/reset', (req, res) => {
  plonkProver.resetStats();
  res.json({ message: 'Statistics reset successfully' });
});

module.exports = router;