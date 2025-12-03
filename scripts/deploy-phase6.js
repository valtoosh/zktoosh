// scripts/deploy-phase6.js
const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n🚀 zkUlt Phase 6 Unified Deployment Script');
  console.log('═══════════════════════════════════════════════\n');

  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log('📍 Network:', network);
  console.log('👤 Deployer:', deployer.address);
  console.log('💰 Balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'ETH\n');

  // ============================================
  // STEP 1: Deploy PlonkVerifierPhase6
  // ============================================

  console.log('📝 Deploying PlonkVerifierPhase6...');
  const PlonkVerifierPhase6 = await hre.ethers.getContractFactory("contracts/plonk/PlonkVerifierPhase6.sol:PlonkVerifier");
  const verifier = await PlonkVerifierPhase6.deploy();
  await verifier.waitForDeployment();

  const verifierAddress = await verifier.getAddress();
  console.log('✅ PlonkVerifierPhase6 deployed:', verifierAddress);

  // ============================================
  // STEP 2: Deploy ClaimVerifier
  // ============================================

  console.log('\n📝 Deploying ClaimVerifier...');
  const ClaimVerifier = await hre.ethers.getContractFactory("contracts/plonk/ClaimVerifier.sol:PlonkVerifier");
  const claimVerifier = await ClaimVerifier.deploy();
  await claimVerifier.waitForDeployment();

  const claimVerifierAddress = await claimVerifier.getAddress();
  console.log('✅ ClaimVerifier deployed:', claimVerifierAddress);

  // ============================================
  // STEP 3: Deploy Poseidon
  // ============================================

  console.log('\n📝 Deploying Poseidon...');
  const Poseidon = await hre.ethers.getContractFactory("Poseidon");
  const poseidonHasher = await Poseidon.deploy();
  await poseidonHasher.waitForDeployment();

  const poseidonHasherAddress = await poseidonHasher.getAddress();
  console.log('✅ Poseidon deployed:', poseidonHasherAddress);

  // ============================================
  // STEP 4: Deploy PrivateTransferV4
  // ============================================

  console.log('\n📝 Deploying PrivateTransferV4...');
  const PrivateTransferV4 = await hre.ethers.getContractFactory("PrivateTransferV4");
  const privateTransfer = await PrivateTransferV4.deploy(verifierAddress, claimVerifierAddress, poseidonHasherAddress);
  await privateTransfer.waitForDeployment();

  const transferAddress = await privateTransfer.getAddress();
  console.log('✅ PrivateTransferV4 deployed:', transferAddress);

  // ============================================
  // STEP 4: Wait for confirmations (if not local)
  // ============================================

  if (network !== 'hardhat' && network !== 'localhost') {
    console.log('\n⏳ Waiting for 6 block confirmations...');
    await verifier.deploymentTransaction().wait(6);
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
      await hre.run("verify:verify", {
        address: verifierAddress,
        constructorArguments: [],
      });
      console.log('✅ PlonkVerifierPhase6 verified');
    } catch (error) {
      console.log('⚠️  PlonkVerifierPhase6 verification failed:', error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: claimVerifierAddress,
        constructorArguments: [],
      });
      console.log('✅ ClaimVerifier verified');
    } catch (error) {
      console.log('⚠️  ClaimVerifier verification failed:', error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: transferAddress,
        constructorArguments: [verifierAddress, claimVerifierAddress, poseidonHasherAddress],
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
    version: 'Phase 6 Unified (6B-E)',
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    features: [
      'Phase 6B: Stealth Addresses',
      'Phase 6C: Merkle Tree Anonymity',
      'Phase 6D: Range Proofs',
      'Phase 6E: Encrypted Memos'
    ],
    contracts: {
      PlonkVerifierPhase6: {
        address: verifierAddress,
        blockNumber: verifier.deploymentTransaction()?.blockNumber
      },
      ClaimVerifier: {
        address: claimVerifierAddress,
        blockNumber: claimVerifier.deploymentTransaction()?.blockNumber
      },
      Poseidon: {
        address: poseidonHasherAddress,
        blockNumber: poseidonHasher.deploymentTransaction()?.blockNumber
      },
      PrivateTransferV4: {
        address: transferAddress,
        blockNumber: privateTransfer.deploymentTransaction()?.blockNumber
      }
    },
    circuit: {
      constraints: 20021,
      publicSignals: 17,
      privateInputs: 51
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

  const filename = path.join(deploymentsDir, `phase6-${network}-${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log('\n💾 Deployment info saved:', filename);

  // Update frontend config
  const frontendConfigPath = path.join(__dirname, '../frontend/src/contracts/plonk/config-phase6.json');
  const frontendConfigDir = path.dirname(frontendConfigPath);

  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }

      const frontendConfig = {
      version: 'Phase 6 Unified',
      transferVerifierAddress: verifierAddress,
      claimVerifierAddress: claimVerifierAddress,
      poseidonHasherAddress: poseidonHasherAddress,
      transferAddress: transferAddress,
      network: network,
      chainId: deploymentInfo.chainId,    features: deploymentInfo.features
  };

  fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));
  console.log('💾 Frontend config saved:', frontendConfigPath);

  // ============================================
  // STEP 6: Print summary
  // ============================================

  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ Phase 6 Deployment Complete!');
  console.log('═══════════════════════════════════════════════\n');
  console.log('📋 Contract Addresses:');
  console.log('   PlonkVerifierPhase6:', verifierAddress);
  console.log('   ClaimVerifier:      ', claimVerifierAddress);
  console.log('   Poseidon:           ', poseidonHasherAddress);
  console.log('   PrivateTransferV4:  ', transferAddress);
  console.log('\n🔗 Etherscan:');
  console.log('   Transfer Verifier:', deploymentInfo.verification.etherscan.replace(transferAddress, verifierAddress));
  console.log('   Claim Verifier:   ', deploymentInfo.verification.etherscan.replace(transferAddress, claimVerifierAddress));
  console.log('   Transfer Contract:', deploymentInfo.verification.etherscan);
  console.log('\n🎯 Features Deployed:');
  deploymentInfo.features.forEach(feature => console.log('   ✅', feature));
  console.log('\n📊 Circuit Stats:');
  console.log('   Constraints:', deploymentInfo.circuit.constraints);
  console.log('   Public Signals:', deploymentInfo.circuit.publicSignals);
  console.log('   Private Inputs:', deploymentInfo.circuit.privateInputs);
  console.log('\n🔒 Privacy Score: 9/10');
  console.log('\n🚀 Ready to use zkUlt Phase 6!\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
