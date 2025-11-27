// backend/src/services/merkleSync.js
const { ethers } = require('ethers');
const path = require('path');

/**
 * Merkle Tree Synchronization Service
 *
 * Syncs the backend's Merkle tree state with the on-chain contract state.
 * This prevents "Invalid Merkle root" errors by ensuring the proof generation
 * uses the correct current root from the blockchain.
 */
class MerkleSync {
  constructor(contractAddress, providerUrl, merkleTreeManager) {
    this.contractAddress = contractAddress;
    this.provider = new ethers.JsonRpcProvider(providerUrl);
    this.merkleTreeManager = merkleTreeManager;

    this.contract = new ethers.Contract(
      contractAddress,
      [
        'function merkleTree() view returns (uint256 root, uint256 size, uint256 nextIndex)',
        'function merkleLeaves(uint256 index) view returns (uint256 leaf)'
      ],
      this.provider
    );
  }

  /**
   * Get Merkle root matching contract's exact behavior
   * Contract behavior (PrivateTransferV4.sol):
   * - size=0: return 0
   * - size=1: return leaf itself (no hashing)
   * - size=2+: return Poseidon hash
   */
  _getContractMatchingRoot() {
    const size = this.merkleTreeManager._layers[0].length;

    if (size === 0) {
      return '0'; // Contract line 146: merkleTree.root = 0
    }

    if (size === 1) {
      return this.merkleTreeManager._layers[0][0]; // Contract line 344: return merkleLeaves[0]
    }

    // For size >= 2, use library's computed root (which matches contract's Poseidon hashing)
    return this.merkleTreeManager.root;
  }

  /**
   * Sync backend Merkle tree with on-chain state
   */
  async syncWithContract() {
    console.log('\n🔄 Syncing Merkle tree with on-chain state...');

    try {
      // Fetch on-chain Merkle state
      const onChainState = await this.contract.merkleTree();
      const onChainRoot = onChainState.root.toString();
      const onChainSize = Number(onChainState.size);
      const onChainNextIndex = Number(onChainState.nextIndex);

      console.log('📡 On-chain Merkle state:');
      console.log('   Root:', onChainRoot);
      console.log('   Size:', onChainSize);
      console.log('   NextIndex:', onChainNextIndex);

      // Get backend state
      const backendRoot = this._getContractMatchingRoot();
      const backendSize = this.merkleTreeManager._layers[0].length;

      console.log('💾 Backend Merkle state:');
      console.log('   Root:', backendRoot);
      console.log('   Size:', backendSize);

      // Check if sync is needed
      if (backendRoot === onChainRoot && backendSize === onChainSize) {
        console.log('✅ Already in sync - no action needed');
        return {
          synced: true,
          root: backendRoot,
          size: backendSize,
          action: 'none'
        };
      }

      // Sync needed
      console.log('⚠️  Out of sync - syncing backend with on-chain state...');

      if (onChainSize === 0) {
        // Contract has no leaves - reset backend
        console.log('   Action: Resetting backend Merkle tree (contract is empty)');
        this.merkleTreeManager._layers[0] = [];

        return {
          synced: true,
          root: '0',
          size: 0,
          action: 'reset'
        };
      }

      // Fetch all leaves from contract and rebuild tree
      console.log(`   Action: Fetching ${onChainSize} leaves from contract...`);
      const leaves = [];

      for (let i = 0; i < onChainSize; i++) {
        const leaf = await this.contract.merkleLeaves(i);
        const leafStr = leaf.toString();
        leaves.push(leafStr);
        console.log(`   📍 Fetched leaf[${i}]: ${leafStr}`);

        if ((i + 1) % 10 === 0) {
          console.log(`   Progress: ${i + 1}/${onChainSize} leaves fetched`);
        }
      }

      console.log(`   Rebuilding Merkle tree with ${leaves.length} leaves...`);
      console.log(`   Expected on-chain root after rebuild: ${onChainRoot}`);

      // Rebuild backend tree by clearing and inserting leaves
      console.log(`   Rebuilding Merkle tree with ${leaves.length} leaves...`);
      this.merkleTreeManager._layers[0] = [];
      for (const leaf of leaves) {
        this.merkleTreeManager.insert(leaf);
      }

      const newRoot = this._getContractMatchingRoot();
      const newSize = this.merkleTreeManager._layers[0].length;

      console.log('✅ Sync complete!');
      console.log('   New backend root:', newRoot);
      console.log('   New backend size:', newSize);

      // Verify sync
      if (newRoot !== onChainRoot) {
        console.warn('⚠️  WARNING: Roots still don\'t match after sync!');
        console.warn('   Expected:', onChainRoot);
        console.warn('   Got:', newRoot);
      }

      return {
        synced: newRoot === onChainRoot,
        root: newRoot,
        size: newSize,
        action: 'rebuilt',
        leaves: leaves.length
      };

    } catch (error) {
      console.error('❌ Merkle sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current on-chain Merkle root (fast check)
   */
  async getCurrentRoot() {
    try {
      const state = await this.contract.merkleTree();
      return state.root.toString();
    } catch (error) {
      console.error('Failed to fetch on-chain root:', error.message);
      return null;
    }
  }

  /**
   * Check if backend is in sync with contract
   */
  async isInSync() {
    try {
      const onChainRoot = await this.getCurrentRoot();
      const backendRoot = this._getContractMatchingRoot();
      const onChainSize = (await this.contract.merkleTree()).size;
      const backendSize = this.merkleTreeManager._layers[0].length;

      return onChainRoot === backendRoot && Number(onChainSize) === backendSize;
    } catch (error) {
      console.error('Sync check failed:', error.message);
      return false;
    }
  }
}

module.exports = MerkleSync;
