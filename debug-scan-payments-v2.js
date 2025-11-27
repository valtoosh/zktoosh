const { ethers } = require('ethers');

async function debugScan() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/dbde77edfe80476f96a9db02e3eb8a83');
  
  // NEW fresh contract address
  const contractAddress = '0xEA463a0C44a64E8f0051230e6027B3C32f0fcF04';
  
  const abi = [
    'function getStealthPaymentCount() external view returns (uint256)',
    'function getStealthPayment(uint256) external view returns (uint256 stealthAddr, uint256 ephemeralPubKey, bytes32 memo, uint256 timestamp, bool claimed)',
    'event StealthPaymentCreated(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  console.log('🔍 Debugging Automatic Scan on NEW contract:', contractAddress);
  console.log('');
  
  try {
    // Step 1: Get count (like automatic scan does)
    const count = await contract.getStealthPaymentCount();
    console.log('Step 1: getStealthPaymentCount() =', count.toString());
    console.log('');
    
    if (Number(count) === 0) {
      console.log('❌ PROBLEM FOUND: Contract has NO stealth payments in the list!');
      console.log('   This means the transfer did not add to stealthAddressList.');
      console.log('');
      console.log('   Checking for StealthPaymentCreated events instead...');
      console.log('');
      
      // Check for events
      const filter = contract.filters.StealthPaymentCreated();
      const events = await contract.queryFilter(filter, 0, 'latest');
      
      if (events.length > 0) {
        console.log(`✅ Found ${events.length} StealthPaymentCreated event(s):`);
        events.forEach((event, i) => {
          console.log(`\nEvent ${i}:`);
          console.log('  Stealth Address:', event.args.stealthAddress.toString());
          console.log('  Ephemeral Public Key:', event.args.ephemeralPublicKey.toString());
          console.log('  Encrypted Memo:', event.args.encryptedMemo);
          console.log('  Timestamp:', new Date(Number(event.args.timestamp) * 1000).toISOString());
          console.log('  Block:', event.blockNumber);
          console.log('  Tx Hash:', event.transactionHash);
        });
        
        console.log('\n⚠️  The events exist but getStealthPaymentCount() returns 0!');
        console.log('   This is a contract bug - payments are not being added to stealthAddressList.');
      } else {
        console.log('❌ No StealthPaymentCreated events found either.');
        console.log('   This means no transfer has been executed on this contract yet.');
      }
    } else {
      // Step 2: Scan all payments (like automatic scan does)
      console.log(`Step 2: Scanning ${count} payment(s)...\n`);
      
      for (let i = 0; i < Number(count); i++) {
        const payment = await contract.getStealthPayment(i);
        console.log(`Payment ${i}:`);
        console.log('  Stealth Address:', payment.stealthAddr.toString());
        console.log('  Ephemeral Public Key:', payment.ephemeralPubKey.toString());
        console.log('  Memo:', payment.memo);
        console.log('  Timestamp:', new Date(Number(payment.timestamp) * 1000).toISOString());
        console.log('  Claimed:', payment.claimed);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugScan();
