const { ethers } = require('ethers');

async function queryTx() {
  const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');
  
  const txHash = '0x74738076dfd78b8389662c9867044155b9d2236585d66ad14e36c23e8b79e90d';
  const contractAddress = '0xEA463a0C44a64E8f0051230e6027B3C32f0fcF04';
  
  console.log('Querying successful transaction:', txHash);
  console.log('Contract:', contractAddress);
  console.log('');
  
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log('Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
    console.log('Block:', receipt.blockNumber);
    console.log('');
    
    // Decode logs using the contract ABI
    const iface = new ethers.Interface([
      'event PrivateTransfer(address indexed sender, uint256 indexed nullifier, uint256 indexed stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp, bool valid)',
      'event StealthPaymentCreated(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp)'
    ]);
    
    console.log('Decoded Events:');
    receipt.logs.forEach((log, i) => {
      if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
        try {
          const parsed = iface.parseLog({ topics: log.topics, data: log.data });
          console.log(`\nEvent ${i}: ${parsed.name}`);
          console.log('  Args:', JSON.stringify(parsed.args, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
        } catch (e) {
          console.log(`\nLog ${i}: Unable to decode`);
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

queryTx();
