// scripts/deploy-claim-system.js
const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n🚀 zkUlt ZK Claiming System Deployment');
  console.log('═══════════════════════════════════════════════════\n');

  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log('📍 Network:', network);
  console.log('👤 Deployer:', deployer.address);
  console.log('💰 Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // ============================================
  // STEP 1: Deploy PlonkVerifierPhase6 (for transfers)
  // ============================================

  console.log('📝 Step 1: Deploying PlonkVerifierPhase6 (Phase 6 transfers)...');
  const PlonkVerifierPhase6 = await hre.ethers.getContractFactory("PlonkVerifierPhase6");
  const transferVerifier = await PlonkVerifierPhase6.deploy();
  await transferVerifier.waitForDeployment();

  const transferVerifierAddress = await transferVerifier.getAddress();
  console.log('✅ PlonkVerifierPhase6 deployed:', transferVerifierAddress);

  // ============================================
  // STEP 2: Deploy ClaimVerifier (for claiming)
  // ============================================

  console.log('\n📝 Step 2: Deploying ClaimVerifier...');
  const ClaimVerifier = await hre.ethers.getContractFactory("ClaimVerifier");
  const claimVerifier = await ClaimVerifier.deploy();
  await claimVerifier.waitForDeployment();

  const claimVerifierAddress = await claimVerifier.getAddress();
  console.log('✅ ClaimVerifier deployed:', claimVerifierAddress);

  // ============================================
  // STEP 3: Deploy PrivateTransferV4
  // ============================================

  console.log('\n📝 Step 3: Deploying PrivateTransferV4...');
  const PrivateTransferV4 = await hre.ethers.getContractFactory("PrivateTransferV4");
  const privateTransfer = await PrivateTransferV4.deploy(
    transferVerifierAddress,
    claimVerifierAddress
  );
  await privateTransfer.waitForDeployment();

  const transferAddress = await privateTransfer.getAddress();
  console.log('✅ PrivateTransferV4 deployed:', transferAddress);

  // ============================================
  // STEP 4: Wait for confirmations (if not local)
  // ============================================

  if (network !== 'hardhat' && network !== 'localhost') {
    console.log('\n⏳ Waiting for 6 block confirmations...');
    await transferVerifier.deploymentTransaction().wait(6);
    await claimVerifier.deploymentTransaction().wait(6);
    await privateTransfer.deploymentTransaction().wait(6);
    console.log('✅ Confirmations received');
  }

  // ============================================
  // STEP 5: Verify contracts on Etherscan
  // ============================================

  if (network !== 'hardhat' && network !== 'localhost') {
    console.log('\n🔍 Verifying contracts on Etherscan...');

    try {
      // Verify PlonkVerifierPhase6
      await hre.run("verify:verify", {
        address: transferVerifierAddress,
        constructorArguments: [],
      });
      console.log('✅ PlonkVerifierPhase6 verified');
    } catch (error) {
      console.log('⚠️  PlonkVerifierPhase6 verification failed:', error.message);
    }

    try {
      // Verify ClaimVerifier
      await hre.run("verify:verify", {
        address: claimVerifierAddress,
        constructorArguments: [],
      });
      console.log('✅ ClaimVerifier verified');
    } catch (error) {
      console.log('⚠️  ClaimVerifier verification failed:', error.message);
    }

    try {
      // Verify PrivateTransferV4
      await hre.run("verify:verify", {
        address: transferAddress,
        constructorArguments: [transferVerifierAddress, claimVerifierAddress],
      });
      console.log('✅ PrivateTransferV4 verified');
    } catch (error) {
      console.log('⚠️  PrivateTransferV4 verification failed:', error.message);
    }
  }

  // ============================================
  // STEP 6: Save deployment info
  // ============================================

  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    deploymentType: 'ZK Claiming System',
    contracts: {
      PlonkVerifierPhase6: {
        address: transferVerifierAddress,
        blockNumber: transferVerifier.deploymentTransaction()?.blockNumber,
        purpose: 'Verifies Phase 6 transfer proofs (stealth, merkle, range, memo)'
      },
      ClaimVerifier: {
        address: claimVerifierAddress,
        blockNumber: claimVerifier.deploymentTransaction()?.blockNumber,
        purpose: 'Verifies ZK claiming proofs'
      },
      PrivateTransferV4: {
        address: transferAddress,
        blockNumber: privateTransfer.deploymentTransaction()?.blockNumber,
        purpose: 'Main contract with ZK claiming support'
      }
    },
    verification: {
      transferVerifier: `https://${network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${transferVerifierAddress}`,
      claimVerifier: `https://${network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${claimVerifierAddress}`,
      transfer: `https://${network === 'sepolia' ? 'sepolia.' : ''}etherscan.io/address/${transferAddress}`
    }
  };

  // Save to file
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = path.join(deploymentsDir, `claim-system-${network}-${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log('\n💾 Deployment info saved:', filename);

  // Update frontend config (Phase 6 config)
  const frontendConfigPath = path.join(__dirname, '../frontend/src/contracts/plonk/config-phase6.json');
  const frontendConfigDir = path.dirname(frontendConfigPath);

  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }

  const frontendConfig = {
    transferVerifierAddress: transferVerifierAddress,
    claimVerifierAddress: claimVerifierAddress,
    transferAddress: transferAddress,
    network: network,
    chainId: deploymentInfo.chainId
  };

  fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));
  console.log('💾 Frontend config updated:', frontendConfigPath);

  // ============================================
  // STEP 7: Print summary
  // ============================================

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ ZK Claiming System Deployment Complete!');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('📋 Contract Addresses:');
  console.log('   PlonkVerifierPhase6:', transferVerifierAddress);
  console.log('   ClaimVerifier:', claimVerifierAddress);
  console.log('   PrivateTransferV4:', transferAddress);
  console.log('\n🔗 Etherscan Links:');
  console.log('   Transfer Verifier:', deploymentInfo.verification.transferVerifier);
  console.log('   Claim Verifier:', deploymentInfo.verification.claimVerifier);
  console.log('   Main Contract:', deploymentInfo.verification.transfer);
  console.log('\n🎯 Features Enabled:');
  console.log('   ✅ Phase 6B: Stealth Addresses');
  console.log('   ✅ Phase 6C: Merkle Anonymity (1M capacity)');
  console.log('   ✅ Phase 6D: Range Proofs (64-bit)');
  console.log('   ✅ Phase 6E: Encrypted Memos');
  console.log('   ✅ ZK Claiming: Proof-based fund transfers');
  console.log('\n🚀 Ready to test ZK claiming!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
