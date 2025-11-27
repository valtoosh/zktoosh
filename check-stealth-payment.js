const { ethers } = require('ethers');

async function checkStealthPayment() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/dbde77edfe80476f96a9db02e3eb8a83');
  const contractAddress = '0xAa5da3d6d7671b2961b230D8676Bf8287008A8D3';
  
  const abi = [
    'function stealthPayments(uint256) view returns (uint256 stealthAddress, uint256 ephemeralPublicKey, uint256 timestamp, bytes32 encryptedMemo, bool claimed)',
    'event StealthTransfer(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, uint256 transferAmount, uint256 assetId, bytes32 encryptedMemo)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  const stealthAddr = '20323399430168737281104400779440323898281793107077081073212135123944556588380';
  
  console.log('🔍 Checking stealth payment details...\n');
  console.log('Stealth Address:', stealthAddr);
  
  try {
    const payment = await contract.stealthPayments(stealthAddr);
    console.log('\n📦 On-Chain Payment Data:');
    console.log('   Stealth Address:', payment.stealthAddress.toString());
    console.log('   Ephemeral Public Key:', payment.ephemeralPublicKey.toString());
    console.log('   Timestamp:', new Date(Number(payment.timestamp) * 1000).toISOString());
    console.log('   Encrypted Memo:', payment.encryptedMemo);
    console.log('   Claimed:', payment.claimed);
    
    // Search for the StealthTransfer event
    console.log('\n🔍 Searching for StealthTransfer event...');
    const filter = contract.filters.StealthTransfer(stealthAddr);
    const events = await contract.queryFilter(filter, 0, 'latest');
    
    if (events.length > 0) {
      console.log('\n✅ Found StealthTransfer event:');
      events.forEach((event, i) => {
        console.log(`\n   Event ${i+1}:`);
        console.log('   Stealth Address:', event.args.stealthAddress.toString());
        console.log('   Ephemeral Public Key:', event.args.ephemeralPublicKey.toString());
        console.log('   Transfer Amount:', event.args.transferAmount.toString());
        console.log('   Asset ID:', event.args.assetId.toString());
        console.log('   Encrypted Memo:', event.args.encryptedMemo);
        console.log('   Block:', event.blockNumber);
        console.log('   Tx Hash:', event.transactionHash);
      });
    } else {
      console.log('❌ No StealthTransfer event found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStealthPayment();
