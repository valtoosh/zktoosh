// Check claim transaction details on Etherscan
const { ethers } = require('ethers');

async function checkClaimTransaction() {
  const txHash = process.argv[2];

  if (!txHash) {
    console.log('Usage: node check-claim-transaction.js <txHash>');
    console.log('Example: node check-claim-transaction.js 0x23fbb9d4e68f7c034f...');
    process.exit(1);
  }

  console.log('\n🔍 Checking Claim Transaction');
  console.log('================================');
  console.log('TX Hash:', txHash);
  console.log('');

  try {
    // Connect to Sepolia
    const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      console.log('❌ Transaction not found or not mined yet');
      return;
    }

    console.log('✅ Transaction found!');
    console.log('');
    console.log('📊 Basic Info:');
    console.log('  Block:', receipt.blockNumber);
    console.log('  From:', receipt.from);
    console.log('  To (Contract):', receipt.to);
    console.log('  Status:', receipt.status === 1 ? '✅ Success' : '❌ Failed');
    console.log('  Gas Used:', receipt.gasUsed.toString());
    console.log('');

    // Get transaction data
    const tx = await provider.getTransaction(txHash);
    console.log('📝 Transaction Data:');
    console.log('  Function Selector:', tx.data.slice(0, 10));
    console.log('');

    // Parse logs (events)
    console.log('📋 Events Emitted:');
    receipt.logs.forEach((log, i) => {
      console.log(`\n  Event ${i + 1}:`);
      console.log('    Address:', log.address);
      console.log('    Topics:', log.topics.length);

      // Try to decode TransferClaimed event
      // TransferClaimed(uint256 recipientHash, address claimer, uint256 amount, uint256 timestamp)
      if (log.topics.length >= 2) {
        try {
          const recipientHash = log.topics[1];
          console.log('    Recipient Hash:', recipientHash);

          // Decode data (amount, timestamp)
          if (log.data && log.data !== '0x') {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
              ['address', 'uint256', 'uint256'],
              log.data
            );
            console.log('    Claimer:', decoded[0]);
            console.log('    Amount:', decoded[1].toString(), 'units');
            console.log('    Timestamp:', decoded[2].toString());
          }
        } catch (e) {
          console.log('    (Raw data - could not decode)');
        }
      }
    });

    console.log('\n');
    console.log('🔗 View on Etherscan:');
    console.log(`https://sepolia.etherscan.io/tx/${txHash}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkClaimTransaction();
