// Quick script to check if a pending transfer exists
const { ethers } = require('ethers');
const PrivateTransferV3Artifact = require('../frontend/src/contracts/plonk/PrivateTransferV3.json');
const contractConfig = require('../frontend/src/contracts/plonk/config.json');

async function checkPendingTransfer() {
  const recipientHash = process.argv[2];

  if (!recipientHash) {
    console.log('Usage: node check-pending-transfer.js <recipientHash>');
    console.log('Example: node check-pending-transfer.js 1234567890123456789...');
    process.exit(1);
  }

  // Connect to Sepolia
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');

  // Or use a different RPC if you prefer
  // const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');

  const contract = new ethers.Contract(
    contractConfig.transferAddress,
    PrivateTransferV3Artifact.abi,
    provider
  );

  console.log('\n🔍 Checking Pending Transfer');
  console.log('================================');
  console.log('Contract:', contractConfig.transferAddress);
  console.log('Recipient Hash:', recipientHash);
  console.log('');

  try {
    const transfer = await contract.getPendingTransfer(recipientHash);
    const [amount, assetId, timestamp, claimed] = transfer;

    console.log('📊 Results:');
    console.log('  Amount:', amount.toString(), '(0 means no transfer found)');
    console.log('  Asset ID:', assetId.toString());
    console.log('  Timestamp:', timestamp.toString(), timestamp > 0 ? `(${new Date(Number(timestamp) * 1000).toLocaleString()})` : '');
    console.log('  Claimed:', claimed);
    console.log('');

    if (amount.toString() === '0') {
      console.log('❌ No pending transfer found for this hash');
      console.log('');
      console.log('Possible reasons:');
      console.log('  1. Transfer transaction did not create a pending transfer (vPubDelta != 0)');
      console.log('  2. Wrong recipientHash copied');
      console.log('  3. Transfer was to old contract address');
      console.log('  4. Transfer already claimed');
    } else if (claimed) {
      console.log('⚠️  Transfer found but already claimed');
    } else {
      console.log('✅ Pending transfer found and ready to claim!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkPendingTransfer();
