const { ethers } = require('ethers');

async function checkPayment() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/dbde77edfe80476f96a9db02e3eb8a83');
  
  // NEW contract address
  const contractAddress = '0xEeBb97aE6980FD1E2E271FC58b58BAAfDCEd034c';
  
  const abi = [
    'function stealthPayments(uint256) view returns (uint256 stealthAddress, uint256 ephemeralPublicKey, uint256 timestamp, bytes32 encryptedMemo, bool claimed)',
    'event StealthTransfer(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, uint256 transferAmount, uint256 assetId, bytes32 encryptedMemo)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  console.log('🔍 Checking NEW contract:', contractAddress);
  console.log('\nSearching for all StealthTransfer events...\n');
  
  try {
    const filter = contract.filters.StealthTransfer();
    const events = await contract.queryFilter(filter, 0, 'latest');
    
    if (events.length > 0) {
      console.log(`✅ Found ${events.length} transfer(s):\n`);
      events.forEach((event, i) => {
        console.log(`Transfer ${i+1}:`);
        console.log('  Stealth Address:', event.args.stealthAddress.toString());
        console.log('  Ephemeral Public Key:', event.args.ephemeralPublicKey.toString());
        console.log('  Transfer Amount:', event.args.transferAmount.toString());
        console.log('  Asset ID:', event.args.assetId.toString());
        console.log('  Block:', event.blockNumber);
        console.log('  Tx Hash:', event.transactionHash);
        console.log('');
      });
    } else {
      console.log('❌ No transfers found on this contract');
      console.log('   This means no transfer has been made to the NEW contract yet!');
      console.log('   You need to make a NEW transfer using the fixed system.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPayment();
