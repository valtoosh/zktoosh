// Check balance on contract
const { ethers } = require('ethers');
const PrivateTransferV3Artifact = require('../frontend/src/contracts/plonk/PrivateTransferV3.json');
const contractConfig = require('../frontend/src/contracts/plonk/config.json');

async function checkBalance() {
  const address = process.argv[2];

  if (!address) {
    console.log('Usage: node check-balance.js <address>');
    console.log('Example: node check-balance.js 0x195eff9bdb9b0eed8d0fede8fd9bf6bff0352dc5');
    process.exit(1);
  }

  console.log('\n💰 Checking Balance on Contract');
  console.log('================================');
  console.log('Contract:', contractConfig.transferAddress);
  console.log('Address:', address);
  console.log('');

  try {
    // Try multiple RPC endpoints
    const rpcUrls = [
      'https://eth-sepolia.g.alchemy.com/v2/demo',
      'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      'https://rpc2.sepolia.org'
    ];

    let provider;
    for (const rpcUrl of rpcUrls) {
      try {
        provider = new ethers.JsonRpcProvider(rpcUrl);
        await provider.getBlockNumber(); // Test connection
        console.log('✅ Connected to RPC:', rpcUrl);
        break;
      } catch (e) {
        console.log('❌ Failed RPC:', rpcUrl);
        continue;
      }
    }

    if (!provider) {
      throw new Error('All RPC endpoints failed');
    }

    const contract = new ethers.Contract(
      contractConfig.transferAddress,
      PrivateTransferV3Artifact.abi,
      provider
    );

    console.log('');
    console.log('📊 Balance Info:');

    // Get balance
    const balance = await contract.getBalance(address);
    console.log('  Raw balance:', balance.toString(), 'wei');
    console.log('  In ETH:', ethers.formatEther(balance), 'ETH');
    console.log('  In units (1 unit = 0.001 ETH):', Number(ethers.formatEther(balance)) * 1000, 'units');

    // Try to get encrypted balance
    try {
      const encryptedBalance = await contract.getEncryptedBalance(address);
      console.log('');
      console.log('🔒 Encrypted Balance (sct):');
      console.log('  ', encryptedBalance.toString());
    } catch (e) {
      console.log('');
      console.log('🔒 Encrypted Balance: Not available or 0');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBalance();
