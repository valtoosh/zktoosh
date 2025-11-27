// scripts/whitelist-assets.js
const hre = require("hardhat");
const contractConfig = require("../frontend/src/contracts/plonk/config.json");

async function main() {
  console.log('🔐 Whitelisting Assets\n');
  console.log('═══════════════════════════════════════');
  
  const [signer] = await hre.ethers.getSigners();
  console.log('Owner account:', signer.address);
  
  const PrivateTransferV3 = await hre.ethers.getContractFactory("PrivateTransferV3");
  const contract = PrivateTransferV3.attach(contractConfig.transferAddress);
  
  // Check if we're the owner
  const owner = await contract.owner();
  console.log('Contract owner:', owner);
  
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error('❌ You are not the contract owner!');
    return;
  }
  
  console.log('✅ Owner verified\n');
  console.log('═══════════════════════════════════════\n');
  
  // Whitelist assets
  const assetsToWhitelist = [1998, 2000];
  
  for (const assetId of assetsToWhitelist) {
    console.log(`📝 Whitelisting asset ${assetId}...`);
    
    // Check current status
    const currentStatus = await contract.isAssetWhitelisted(assetId);
    console.log(`   Current status: ${currentStatus ? 'Already whitelisted' : 'Not whitelisted'}`);
    
    if (!currentStatus) {
      const tx = await contract.setAssetWhitelist(assetId, true);
      console.log(`   Transaction sent: ${tx.hash}`);
      
      await tx.wait();
      console.log(`   ✅ Asset ${assetId} whitelisted!`);
    } else {
      console.log(`   ⏭️  Skipping (already whitelisted)`);
    }
    console.log();
  }
  
  console.log('═══════════════════════════════════════');
  console.log('✅ All assets whitelisted successfully!\n');
  
  // Verify final status
  console.log('📋 Final Whitelist Status:');
  for (const assetId of assetsToWhitelist) {
    const isWhitelisted = await contract.isAssetWhitelisted(assetId);
    console.log(`   Asset ${assetId}: ${isWhitelisted ? '✅' : '❌'}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });