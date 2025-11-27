// scripts/deploy-plonk.js
const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n🚀 zkUlt PLONK Deployment Script');
  console.log('═══════════════════════════════════════\n');

  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  
  console.log('📍 Network:', network);
  console.log('👤 Deployer:', deployer.address);
  console.log('💰 Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // ============================================
  // STEP 1: Deploy PlonkVerifier
  // ============================================
  
  console.log('📝 Deploying PlonkVerifier...');
  const PlonkVerifier = await hre.ethers.getContractFactory("PlonkVerifier");
  const verifier = await PlonkVerifier.deploy();
  await verifier.waitForDeployment();
  
  const verifierAddress = await verifier.getAddress();
  console.log('✅ PlonkVerifier deployed:', verifierAddress);

  // ============================================
  // STEP 2: Deploy PrivateTransferV3
  // ============================================
  
  console.log('\n📝 Deploying PrivateTransferV3...');
  const PrivateTransferV3 = await hre.ethers.getContractFactory("PrivateTransferV3");
  const privateTransfer = await PrivateTransferV3.deploy(verifierAddress);
  await privateTransfer.waitForDeployment();
  
  const transferAddress = await privateTransfer.getAddress();
  console.log('✅ PrivateTransferV3 deployed:', transferAddress);

  // ============================================
  // STEP 3: Wait for confirmations (if not local)
  // ============================================
  
  if (network !== 'hardhat' && network !== 'localhost') {
    console.log('\n⏳ Waiting for 6 block confirmations...');
    await verifier.deploymentTransaction().wait(6);
    await privateTransfer.deploymentTransaction().wait(6);
    console.log('✅ Confirmations received');
  }

  // ============================================
  // STEP 4: Verify contracts on Etherscan
  // ============================================
  
  if (network !== 'hardhat' && network !== 'localhost') {
    console.log('\n🔍 Verifying contracts on Etherscan...');
    
    try {
      // Verify PlonkVerifier
      await hre.run("verify:verify", {
        address: verifierAddress,
        constructorArguments: [],
      });
      console.log('✅ PlonkVerifier verified');
    } catch (error) {
      console.log('⚠️  PlonkVerifier verification failed:', error.message);
    }

    try {
      // Verify PrivateTransferV3
      await hre.run("verify:verify", {
        address: transferAddress,
        constructorArguments: [verifierAddress],
      });
      console.log('✅ PrivateTransferV3 verified');
    } catch (error) {
      console.log('⚠️  PrivateTransferV3 verification failed:', error.message);
    }
  }

  // ============================================
  // STEP 5: Save deployment info
  // ============================================
  
  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      PlonkVerifier: {
        address: verifierAddress,
        blockNumber: verifier.deploymentTransaction()?.blockNumber
      },
      PrivateTransferV3: {
        address: transferAddress,
        blockNumber: privateTransfer.deploymentTransaction()?.blockNumber
      }
    },
    verification: {
      etherscan: `https://${network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${transferAddress}`
    }
  };

  // Save to file
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = path.join(deploymentsDir, `plonk-${network}-${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log('\n💾 Deployment info saved:', filename);

  // Update frontend config
  const frontendConfigPath = path.join(__dirname, '../frontend/src/contracts/plonk/config.json');
  const frontendConfigDir = path.dirname(frontendConfigPath);
  
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }

  const frontendConfig = {
    verifierAddress: verifierAddress,
    transferAddress: transferAddress,
    network: network,
    chainId: deploymentInfo.chainId
  };

  fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));
  console.log('💾 Frontend config updated:', frontendConfigPath);

  // ============================================
  // STEP 6: Print summary
  // ============================================
  
  console.log('\n═══════════════════════════════════════');
  console.log('✅ Deployment Complete!');
  console.log('═══════════════════════════════════════\n');
  console.log('📋 Contract Addresses:');
  console.log('   PlonkVerifier:', verifierAddress);
  console.log('   PrivateTransferV3:', transferAddress);
  console.log('\n🔗 Etherscan:');
  console.log('   Verifier:', deploymentInfo.verification.etherscan.replace(transferAddress, verifierAddress));
  console.log('   Transfer:', deploymentInfo.verification.etherscan);
  console.log('\n🚀 Ready to use zkUlt PLONK!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });