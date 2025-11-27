const { ethers } = require('ethers');

async function checkActualTransfer() {
  const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
  
  // NEW contract address
  const contractAddress = '0xEeBb97aE6980FD1E2E271FC58b58BAAfDCEd034c';
  
  const abi = [
    'event StealthTransfer(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, uint256 transferAmount, uint256 assetId, bytes32 encryptedMemo)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  console.log('🔍 Searching for ALL transfers on NEW contract:', contractAddress);
  console.log('');
  
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
        console.log('  Encrypted Memo:', event.args.encryptedMemo);
        console.log('  Block:', event.blockNumber);
        console.log('  Tx Hash:', event.transactionHash);
        console.log('');
      });
    } else {
      console.log('❌ No transfers found on this contract');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkActualTransfer();
