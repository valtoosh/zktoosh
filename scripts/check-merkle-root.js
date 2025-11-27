// Check Merkle root from contract
const { ethers } = require('ethers');

const PHASE6_CONFIG = require('../frontend/src/contracts/plonk/config-phase6.json');

async function checkMerkleRoot() {
  console.log('🔍 Checking Merkle root from contract...\n');

  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161');

  const contract = new ethers.Contract(
    PHASE6_CONFIG.transferAddress,
    [
      'function getMerkleRoot() external view returns (uint256)',
      'function getMerkleTreeSize() external view returns (uint256)'
    ],
    provider
  );

  try {
    const root = await contract.getMerkleRoot();
    const size = await contract.getMerkleTreeSize();

    console.log('📊 Contract Merkle State:');
    console.log(`   Root: ${root.toString()}`);
    console.log(`   Size: ${size.toString()}`);
    console.log(`   Root (hex): 0x${root.toString(16)}`);

    if (root.toString() === '0') {
      console.log('\n⚠️  WARNING: Merkle root is 0 (empty tree)');
      console.log('   This means no transactions have been processed yet.');
      console.log('   The circuit should handle merkleRoot = 0 as a special case.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMerkleRoot();
