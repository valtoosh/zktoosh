const { ethers } = require('ethers');

async function checkTransaction() {
  const provider = ethers.getDefaultProvider('sepolia');
  
  const txHash = '0x74738076dfd78b8389662c9867044155b9d2236585d66ad14e36c23e8b79e90d';
  
  console.log('🔍 Checking transaction:', txHash);
  console.log('');
  
  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    console.log('Transaction Details:');
    console.log('  From:', tx.from);
    console.log('  To (Contract):', tx.to);
    console.log('  Status:', receipt.status === 1 ? '✅ SUCCESS' : '❌ FAILED');
    console.log('  Block:', receipt.blockNumber);
    console.log('  Gas Used:', receipt.gasUsed.toString());
    console.log('');
    
    console.log('Events emitted:');
    receipt.logs.forEach((log, i) => {
      console.log(`\nLog ${i}:`);
      console.log('  Address:', log.address);
      console.log('  Topics:', log.topics);
      console.log('  Data:', log.data);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTransaction();
