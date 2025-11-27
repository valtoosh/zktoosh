const { ethers } = require('ethers');

async function deepAnalysis() {
  console.log('='.repeat(80));
  console.log('DEEP ANALYSIS: Claiming Failure Root Cause Investigation');
  console.log('='.repeat(80));
  console.log('');
  
  // Use public RPC
  const provider = ethers.getDefaultProvider('sepolia');
  
  const NEW_CONTRACT = '0xEA463a0C44a64E8f0051230e6027B3C32f0fcF04';
  
  const abi = [
    'function getStealthPaymentCount() external view returns (uint256)',
    'function stealthPayments(uint256) view returns (uint256 stealthAddress, uint256 ephemeralPublicKey, uint256 encryptedAmount, uint256 timestamp, bytes32 encryptedMemo, bool claimed)',
    'event PrivateTransfer(address indexed sender, uint256 indexed nullifier, uint256 indexed stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp, bool valid)',
    'event StealthPaymentCreated(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp)'
  ];
  
  const contract = new ethers.Contract(NEW_CONTRACT, abi, provider);
  
  console.log('Step 1: Check contract deployment');
  console.log('Contract Address:', NEW_CONTRACT);
  const code = await provider.getCode(NEW_CONTRACT);
  console.log('Contract Code Exists:', code !== '0x');
  console.log('');
  
  console.log('Step 2: Query getStealthPaymentCount()');
  try {
    const count = await contract.getStealthPaymentCount();
    console.log('Payment Count:', count.toString());
    console.log('');
  } catch (error) {
    console.log('ERROR calling getStealthPaymentCount():', error.message);
    console.log('');
  }
  
  console.log('Step 3: Search for PrivateTransfer events');
  try {
    const filter = contract.filters.PrivateTransfer();
    const events = await contract.queryFilter(filter, 0, 'latest');
    console.log(`Found ${events.length} PrivateTransfer event(s)`);
    
    if (events.length > 0) {
      events.forEach((event, i) => {
        console.log(`\nPrivateTransfer Event ${i}:`);
        console.log('  Sender:', event.args.sender);
        console.log('  Nullifier:', event.args.nullifier.toString());
        console.log('  Stealth Address:', event.args.stealthAddress.toString());
        console.log('  Ephemeral Public Key:', event.args.ephemeralPublicKey.toString());
        console.log('  Encrypted Memo:', event.args.encryptedMemo);
        console.log('  Timestamp:', new Date(Number(event.args.timestamp) * 1000).toISOString());
        console.log('  Valid:', event.args.valid);
        console.log('  Block Number:', event.blockNumber);
        console.log('  Tx Hash:', event.transactionHash);
      });
    }
    console.log('');
  } catch (error) {
    console.log('ERROR querying PrivateTransfer events:', error.message);
    console.log('');
  }
  
  console.log('Step 4: Search for StealthPaymentCreated events');
  try {
    const filter = contract.filters.StealthPaymentCreated();
    const events = await contract.queryFilter(filter, 0, 'latest');
    console.log(`Found ${events.length} StealthPaymentCreated event(s)`);
    
    if (events.length > 0) {
      events.forEach((event, i) => {
        console.log(`\nStealthPaymentCreated Event ${i}:`);
        console.log('  Stealth Address:', event.args.stealthAddress.toString());
        console.log('  Ephemeral Public Key:', event.args.ephemeralPublicKey.toString());
        console.log('  Encrypted Memo:', event.args.encryptedMemo);
        console.log('  Timestamp:', new Date(Number(event.args.timestamp) * 1000).toISOString());
        console.log('  Block Number:', event.blockNumber);
        console.log('  Tx Hash:', event.transactionHash);
        
        // Try to query the payment from storage
        console.log('\n  Querying stealthPayments mapping for this address...');
        contract.stealthPayments(event.args.stealthAddress)
          .then(payment => {
            console.log('    Stored Stealth Address:', payment.stealthAddress.toString());
            console.log('    Stored Ephemeral Key:', payment.ephemeralPublicKey.toString());
            console.log('    Encrypted Amount:', payment.encryptedAmount.toString());
            console.log('    Claimed:', payment.claimed);
          })
          .catch(err => {
            console.log('    ERROR:', err.message);
          });
      });
    }
    console.log('');
  } catch (error) {
    console.log('ERROR querying StealthPaymentCreated events:', error.message);
    console.log('');
  }
  
  // Wait for async operations
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('='.repeat(80));
  console.log('Analysis Complete');
  console.log('='.repeat(80));
}

deepAnalysis().catch(console.error);
