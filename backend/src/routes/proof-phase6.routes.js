// backend/src/routes/proof-phase6.routes.js
const snarkjs = require('snarkjs');
const express = require('express');
const router = express.Router();
const plonkProverPhase6 = require('../services/plonkProverPhase6');
const { proofGenerationLimiter } = require('../middleware/rateLimiter');

// Load contract address from config
const path = require('path');
const PHASE6_CONFIG = require(path.join(__dirname, '../../../frontend/src/contracts/plonk/config-phase6.json'));
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';

/**
 * POST /api/proof-phase6/generate
 * Generate a PLONK Phase 6 proof with all privacy features
 * Rate limited to 10 requests/minute per IP
 */
router.post('/generate', proofGenerationLimiter, async (req, res) => {
  try {
    const {
      senderBalance,
      transferAmount,
      recipientAddress,
      recipientViewPublicKey,  // MONERO-STYLE: Accept view public key
      assetId,
      maxAmount,
      salt,
      // Phase 5A: Dual Account Model fields
      vPubIn,
      vPubOut,
      kENA,
      sctOld,
      balanceCommitment,
      // Phase 6B: Stealth address fields
      ephemeralPrivateKey,
      stealthSalt,
      // Phase 6C: Merkle tree fields
      merkleRoot,
      merklePath,
      // Phase 6E: Encrypted memo
      encryptedMemo
    } = req.body;

    // MONERO-STYLE: Accept either recipientAddress or recipientViewPublicKey
    const recipient = recipientViewPublicKey || recipientAddress;

    if (senderBalance === undefined || senderBalance === null ||
        transferAmount === undefined || transferAmount === null ||
        !recipient ||
        assetId === undefined || assetId === null ||
        maxAmount === undefined || maxAmount === null) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['senderBalance', 'transferAmount', 'recipientViewPublicKey (or recipientAddress)', 'assetId', 'maxAmount']
      });
    }

    const input = {
      senderBalance: Number(senderBalance),
      transferAmount: Number(transferAmount),
      recipientViewPublicKey: recipient,  // ECDH: Preserve array format [x, y]
      recipientAddress: recipient,        // Keep for backward compatibility
      assetId: Number(assetId),
      maxAmount: Number(maxAmount),
      salt: salt,
      // Phase 5A parameters
      vPubIn: vPubIn !== undefined ? Number(vPubIn) : undefined,
      vPubOut: vPubOut !== undefined ? Number(vPubOut) : undefined,
      kENA: kENA,
      sctOld: sctOld,
      balanceCommitment: balanceCommitment,
      // Phase 6B parameters
      ephemeralPrivateKey: ephemeralPrivateKey,
      stealthSalt: stealthSalt,
      // Phase 6C parameters
      merkleRoot: merkleRoot,
      merklePath: merklePath,
      // Phase 6E parameters
      encryptedMemo: encryptedMemo
    };

    console.log('\n📥 Received Phase 6 proof generation request');
    console.log('   Sender Balance (ENA):', input.senderBalance);
    console.log('   Transfer Amount:', input.transferAmount);
    console.log('   Recipient:', input.recipientAddress);
    console.log('   Asset ID:', input.assetId);
    console.log('   vPubIn (EOA → ENA):', input.vPubIn || 0);
    console.log('   vPubOut (ENA → EOA):', input.vPubOut || 0);

    // CRITICAL: Sync Merkle tree before proof generation
    if (global.merkleSyncService && global.plonkProverPhase6) {
      console.log('🔄 Syncing Merkle tree with contract...');
      try {
        const syncResult = await global.merkleSyncService.syncWithContract();
        if (syncResult.synced) {
          console.log('✅ Merkle sync complete:');
          console.log('   Root:', syncResult.root);
          console.log('   Size:', syncResult.size);
          console.log('   Action:', syncResult.action);
          input.merkleRoot = syncResult.root;
        } else {
          console.warn('⚠️  Merkle sync incomplete, using backend root');
          input.merkleRoot = global.plonkProverPhase6.merkleTree.root;
        }
      } catch (syncError) {
        console.error('❌ Merkle sync failed:', syncError.message);
        console.warn('⚠️  Using backend Merkle root (may cause Invalid Merkle root error)');
        input.merkleRoot = global.plonkProverPhase6.merkleTree.root;
      }
    } else {
      console.warn('⚠️  Merkle sync service not available. Proofs will likely fail if they require an up-to-date Merkle root.');
      input.merkleRoot = input.merkleRoot || '0'; // Fallback to provided root or 0
    }

    // Generate proof using global prover instance (if available)
    const proverService = global.plonkProverPhase6 || plonkProverPhase6;
    const result = await proverService.generateProof(input);

    // Verify proof off-chain before returning
    const isValid = await proverService.verifyProof(result.proof, result.publicSignals);

    if (!isValid) {
      return res.status(500).json({
        error: 'Generated proof failed verification',
        details: 'This should not happen. Please check circuit constraints.'
      });
    }

    console.log('📤 Sending Phase 6 proof to frontend\n');

    res.json({
      success: true,
      proof: result.proof,
      publicSignals: result.publicSignals,
      proofSystem: 'plonk-phase6',
      generationTime: result.generationTime,
      valid: result.valid,
      newBalance: result.newBalance,
      newBalanceCommitment: result.newBalanceCommitment,
      recipientHash: result.recipientHash,
      recipientAddress: result.recipientAddress,
      nullifier: result.nullifier,
      salt: result.salt,
      kENA: result.kENA,
      sctNew: result.sctNew,
      vPubDelta: result.vPubDelta,
      // Phase 6B: Stealth address outputs
      stealthAddress: result.stealthAddress,
      ephemeralPublicKey: result.ephemeralPublicKey,
      ephemeralPrivateKey: result.ephemeralPrivateKey, // For recipient claiming
      stealthSalt: result.stealthSalt,
      // Phase 6C: Merkle outputs
      merkleLeaf: result.merkleLeaf,
      merkleProofValid: result.merkleProofValid,
      // Phase 6E: Memo hash
      encryptedMemoHash: result.encryptedMemoHash,
      stats: result.stats
    });

  } catch (error) {
    console.error('❌ Phase 6 proof generation error:', error);
    res.status(500).json({
      error: 'Phase 6 proof generation failed',
      message: error.message
    });
  }
});

/**
 * POST /api/proof-phase6/format-for-contract
 * Format Phase 6 proof for Solidity contract submission
 */
router.post('/format-for-contract', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing proof or publicSignals'
      });
    }

    console.log('\n📝 Formatting Phase 6 proof for contract...');
    console.log('📊 Input proof keys:', Object.keys(proof));
    console.log('📊 Input publicSignals length:', publicSignals.length);
    console.log('📊 Expected: 18 public signals (Phase 6)');

    if (publicSignals.length !== 18) {
      console.warn(`⚠️  Warning: Expected 18 signals, got ${publicSignals.length}`);
    }

    const calldata = await snarkjs.plonk.exportSolidityCallData(
      proof,
      publicSignals
    );

    console.log('\n📦 Raw calldata type:', typeof calldata);
    console.log('📦 Raw calldata length:', calldata.length);

    const calldataStr = calldata.toString().trim();
    let proofBytes, publicSignalsArray;

    try {
      const separatorIndex = calldataStr.indexOf('][');

      if (separatorIndex === -1) {
        throw new Error('Could not find ][ separator in calldata');
      }

      const proofArrayStr = calldataStr.substring(0, separatorIndex + 1);
      const proofArray = JSON.parse(proofArrayStr);

      const signalsArrayStr = calldataStr.substring(separatorIndex + 1);
      publicSignalsArray = JSON.parse(signalsArrayStr);

      proofBytes = proofArray; // Keep as array for PlonkVerifier

      console.log('✅ Parsed successfully');
      console.log('   Proof parts:', proofArray.length);
      console.log('   Signals count:', publicSignalsArray.length);
    } catch (parseError) {
      console.error('❌ Failed to parse calldata:', parseError.message);
      proofBytes = null;
      publicSignalsArray = null;
    }

    if (!proofBytes || !publicSignalsArray) {
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
    console.log('📤 Sending formatted Phase 6 proof to frontend\n');

    res.json({
      success: true,
      proofBytes: proofBytes,
      publicSignals: publicSignalsArray
    });

  } catch (error) {
    console.error('❌ Phase 6 proof formatting error:', error);
    res.status(500).json({
      error: 'Phase 6 proof formatting failed',
      message: error.message,
      stack: error.stack
    });
  }
});

/**
 * POST /api/proof-phase6/verify
 * Verify a Phase 6 PLONK proof off-chain
 */
router.post('/verify', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing proof or publicSignals'
      });
    }

    const isValid = await plonkProverPhase6.verifyProof(proof, publicSignals);

    res.json({
      valid: isValid,
      publicSignals: publicSignals
    });

  } catch (error) {
    console.error('❌ Phase 6 proof verification error:', error);
    res.status(500).json({
      error: 'Phase 6 proof verification failed',
      message: error.message
    });
  }
});

/**
 * GET /api/proof-phase6/stats
 * Get Phase 6 proof generation statistics
 */
router.get('/stats', (req, res) => {
  const stats = plonkProverPhase6.getStats();
  res.json(stats);
});

/**
 * POST /api/proof-phase6/stats/reset
 * Reset Phase 6 statistics
 */
router.post('/stats/reset', (req, res) => {
  plonkProverPhase6.resetStats();
  res.json({ message: 'Phase 6 statistics reset successfully' });
});

/**
 * GET /api/proof-phase6/merkle-state
 * Get current Merkle tree state
 */
router.get('/merkle-state', (req, res) => {
  const proverService = global.plonkProverPhase6 || plonkProverPhase6;
  const merkleState = proverService.getMerkleTreeState();
  res.json({
    success: true,
    merkleTree: merkleState
  });
});

module.exports = router;
