// check-contract-state.js
const { ethers } = require('ethers');
const config = require('./frontend/src/contracts/plonk/config-phase6.json');

async function checkContractState() {
  console.log('\n🔍 Checking PrivateTransferV4 Contract State\n');

  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');

  const contract = new ethers.Contract(
    config.transferAddress,
    [
      'function getMerkleRoot() external view returns (uint256)',
      'function getMerkleTreeSize() external view returns (uint256)',
      'function getContractStats() external view returns (uint256 _totalDeposited, uint256 _totalTransfers, uint256 _merkleTreeSize, uint256 _contractBalance)'
    ],
    provider
  );

  try {
    const merkleRoot = await contract.getMerkleRoot();
    const merkleSize = await contract.getMerkleTreeSize();
    const stats = await contract.getContractStats();

    console.log('📊 Contract State:');
    console.log('   Merkle Root:', merkleRoot.toString());
    console.log('   Merkle Tree Size:', merkleSize.toString(), 'leaves');
    console.log('   Total Deposits:', ethers.formatEther(stats[0]), 'ETH');
    console.log('   Total Transfers:', stats[1].toString());
    console.log('   Contract Balance:', ethers.formatEther(stats[3]), 'ETH');
    console.log('\n✅ The contract Merkle tree already has', merkleSize.toString(), 'leaves');
    console.log('   Backend Merkle tree must sync with this state\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkContractState();
