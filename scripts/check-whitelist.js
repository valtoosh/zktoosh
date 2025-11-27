// scripts/check-whitelist.js
const hre = require("hardhat");
const contractConfig = require("../frontend/src/contracts/plonk/config.json");

async function main() {
  console.log('🔍 Checking Contract Whitelist Status\n');
  console.log('═══════════════════════════════════════');
  
  const [signer] = await hre.ethers.getSigners();
  console.log('Using account:', signer.address);
  
  const PrivateTransferV3 = await hre.ethers.getContractFactory("PrivateTransferV3");
  const contract = PrivateTransferV3.attach(contractConfig.transferAddress);
  
  console.log('Contract address:', contractConfig.transferAddress);
  console.log('═══════════════════════════════════════\n');
  
  // Check whitelisted assets
  const assetsToCheck = [1998, 2000, 1999, 0, 1, 2001];
  
  console.log('📋 Asset Whitelist Status:');
  for (const assetId of assetsToCheck) {
    const isWhitelisted = await contract.isAssetWhitelisted(assetId);
    console.log(`   Asset ${assetId}: ${isWhitelisted ? '✅ Whitelisted' : '❌ Not Whitelisted'}`);
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('📊 Contract Stats:');
  const stats = await contract.getContractStats();
  console.log('   Total Deposited:', hre.ethers.formatEther(stats[0]), 'ETH');
  console.log('   Total Transfers:', stats[1].toString());
  console.log('   Contract Balance:', hre.ethers.formatEther(stats[2]), 'ETH');
  
  console.log('\n═══════════════════════════════════════');
  console.log('👤 Your Balance:');
  const balance = await contract.getBalance(signer.address);
  console.log('   ', hre.ethers.formatEther(balance), 'ETH');
  
  console.log('\n═══════════════════════════════════════');
  console.log('🔐 Contract Owner:', await contract.owner());
  console.log('⏸️  Contract Paused:', await contract.paused());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });