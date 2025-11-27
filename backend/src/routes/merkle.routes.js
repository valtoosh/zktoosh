// backend/src/routes/merkle.routes.js
const express = require('express');
const router = express.Router();

/**
 * POST /api/merkle/sync
 * Manually trigger Merkle tree synchronization with on-chain contract
 */
router.post('/sync', async (req, res) => {
  try {
    if (!global.merkleSyncService) {
      return res.status(503).json({
        error: 'Merkle sync service not initialized',
        message: 'Server may still be starting up. Please try again in a moment.'
      });
    }

    console.log('\n🔄 Manual Merkle sync requested...');
    const syncResult = await global.merkleSyncService.syncWithContract();

    if (syncResult.synced) {
      res.json({
        success: true,
        synced: true,
        root: syncResult.root,
        size: syncResult.size,
        action: syncResult.action,
        leaves: syncResult.leaves || null,
        message: 'Merkle tree synchronized successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        synced: false,
        error: 'Merkle tree synchronization incomplete',
        details: syncResult
      });
    }

  } catch (error) {
    console.error('❌ Merkle sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Merkle sync failed',
      message: error.message
    });
  }
});

/**
 * GET /api/merkle/status
 * Check if backend Merkle tree is in sync with on-chain contract
 */
router.get('/status', async (req, res) => {
  try {
    if (!global.merkleSyncService) {
      return res.status(503).json({
        error: 'Merkle sync service not initialized',
        inSync: false
      });
    }

    if (!global.plonkProverPhase6) {
      return res.status(503).json({
        error: 'Prover service not initialized',
        inSync: false
      });
    }

    const isInSync = await global.merkleSyncService.isInSync();
    const onChainRoot = await global.merkleSyncService.getCurrentRoot();
    const backendRoot = global.plonkProverPhase6.merkleTree.root;
    const backendSize = global.plonkProverPhase6.merkleTree.size;

    res.json({
      success: true,
      inSync: isInSync,
      backend: {
        root: backendRoot,
        size: backendSize
      },
      onChain: {
        root: onChainRoot
      },
      message: isInSync ? 'Backend is in sync with contract' : 'Backend is OUT OF SYNC with contract'
    });

  } catch (error) {
    console.error('❌ Merkle status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Merkle status check failed',
      message: error.message
    });
  }
});

/**
 * GET /api/merkle/root
 * Get current on-chain Merkle root
 */
router.get('/root', async (req, res) => {
  try {
    if (!global.merkleSyncService) {
      return res.status(503).json({
        error: 'Merkle sync service not initialized'
      });
    }

    const onChainRoot = await global.merkleSyncService.getCurrentRoot();

    res.json({
      success: true,
      root: onChainRoot
    });

  } catch (error) {
    console.error('❌ Get Merkle root error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Merkle root',
      message: error.message
    });
  }
});

module.exports = router;
