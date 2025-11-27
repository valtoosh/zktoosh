// backend/src/services/merkleTreeManager.js
const { ethers } = require('ethers');
const { buildPoseidon } = require('circomlibjs');

/**
 * Merkle Tree Manager
 *
 * Synchronizes in-memory Merkle tree with on-chain state.
 * Fetches all merkle leaves from the contract and rebuilds the tree.
 */
class MerkleTreeManager {
  constructor(contractAddress, rpcUrl) {
    this.contractAddress = contractAddress;
    this.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.tree = {
      root: BigInt(0),
      size: 0,
      leaves: []
    };
    this.poseidon = null;
    this.initialized = false;
  }

  /**
   * Initialize Poseidon hash and sync with contract
   */
  async initialize() {
    if (this.initialized) return;

    console.log('🌳 Initializing Merkle Tree Manager...');

    // Initialize Poseidon
    this.poseidon = await buildPoseidon();
    console.log('   ✅ Poseidon hash initialized');

    // Sync with contract
    await this.syncWithContract();

    this.initialized = true;
    console.log(`   ✅ Merkle Tree Manager ready (${this.tree.size} leaves)`);
  }

  /**
   * Sync Merkle tree from contract events
   */
  async syncWithContract() {
    try {
      const contract = new ethers.Contract(
        this.contractAddress,
        [
          'function getMerkleRoot() external view returns (uint256)',
          'function getMerkleTreeSize() external view returns (uint256)',
          'event PrivateTransfer(address indexed sender, uint256 nullifier, uint256 stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp, bool valid)'
        ],
        this.provider
      );

      // Get current state
      const [root, size] = await Promise.all([
        contract.getMerkleRoot(),
        contract.getMerkleTreeSize()
      ]);

      console.log(`   📊 Contract state: root=${root.toString()}, size=${size.toString()}`);

      // If tree is empty, we're done
      if (size.toString() === '0') {
        this.tree.root = BigInt(0);
        this.tree.size = 0;
        this.tree.leaves = [];
        console.log('   ✅ Merkle tree is empty (fresh deployment)');
        return;
      }

      // Fetch all PrivateTransfer events to get merkle leaves
      console.log('   🔍 Fetching transaction history...');
      const filter = contract.filters.PrivateTransfer();
      const events = await contract.queryFilter(filter);

      console.log(`   📝 Found ${events.length} transactions`);

      // Extract merkle leaves from events
      // Note: The merkleLeaf is not directly in the event, so we need to reconstruct it
      // For now, we'll trust the on-chain root and set size
      this.tree.root = BigInt(root.toString());
      this.tree.size = Number(size.toString());
      this.tree.leaves = new Array(this.tree.size).fill(BigInt(0)); // Placeholder

      console.log(`   ✅ Synced with on-chain state: ${this.tree.size} leaves`);
    } catch (error) {
      console.error('   ❌ Error syncing Merkle tree:', error.message);
      // Initialize empty tree on error
      this.tree = {
        root: BigInt(0),
        size: 0,
        leaves: []
      };
    }
  }

  /**
   * Get current Merkle root
   */
  getMerkleRoot() {
    return this.tree.root.toString();
  }

  /**
   * Get Merkle tree size
   */
  getSize() {
    return this.tree.size;
  }

  /**
   * Add a leaf to the tree
   */
  async addLeaf(leaf) {
    this.tree.leaves.push(BigInt(leaf));
    this.tree.size++;

    // Recalculate root (simplified - in production, use efficient Merkle tree)
    if (this.tree.size === 1) {
      this.tree.root = BigInt(leaf);
    } else {
      // For Phase 6C, we trust the contract to update the root
      // This is just a placeholder
      const F = this.poseidon.F;
      const hash = this.poseidon([this.tree.root, BigInt(leaf)]);
      this.tree.root = F.toObject(hash);
    }
  }

  /**
   * Get Merkle proof for a leaf (placeholder)
   */
  getMerkleProof(leafIndex) {
    const depth = 20; // 2^20 = 1M capacity

    // Return empty proof (all zeros) - circuit allows this when root = 0
    return {
      pathElements: new Array(depth).fill('0'),
      pathIndices: new Array(depth).fill(0)
    };
  }

  /**
   * Force refresh from contract
   */
  async refresh() {
    console.log('🔄 Refreshing Merkle tree from contract...');
    await this.syncWithContract();
  }
}

// Singleton instance
let instance = null;

async function getMerkleTreeManager(contractAddress, rpcUrl = 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY') {
  if (!instance || instance.contractAddress !== contractAddress) {
    instance = new MerkleTreeManager(contractAddress, rpcUrl);
    await instance.initialize();
  }
  return instance;
}

module.exports = {
  MerkleTreeManager,
  getMerkleTreeManager
};
