// scripts/redeploy-phase6-verifier.js
const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("🚀 Redeploying Phase 6 Verifier with Monero-style support...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying from:", deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Load old config
  const configPath = path.join(__dirname, '../frontend/src/contracts/plonk/config-phase6.json');
  const oldConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log("📋 Old Configuration:");
  console.log("   Transfer Verifier:", oldConfig.transferVerifierAddress);
  console.log("   Transfer Contract:", oldConfig.transferAddress);
  console.log("   Claim Verifier:", oldConfig.claimVerifierAddress);
  console.log("");

  // Deploy new transfer verifier
  console.log("1️⃣  Deploying PlonkVerifierPhase6 (Monero-style)...");
  const PlonkVerifierPhase6 = await hre.ethers.getContractFactory("PlonkVerifierPhase6");
  const transferVerifier = await PlonkVerifierPhase6.deploy();
  await transferVerifier.waitForDeployment();
  const transferVerifierAddress = await transferVerifier.getAddress();
  console.log("   ✅ PlonkVerifierPhase6:", transferVerifierAddress);

  // Update the transfer contract to use new verifier
  console.log("\n2️⃣  Updating PrivateTransferV4 to use new verifier...");
  const PrivateTransferV4 = await hre.ethers.getContractFactory("PrivateTransferV4");
  const transferContract = PrivateTransferV4.attach(oldConfig.transferAddress);

  // Check if contract has updateVerifier function
  try {
    const tx = await transferContract.updateVerifier(transferVerifierAddress);
    await tx.wait();
    console.log("   ✅ Verifier updated successfully");
  } catch (error) {
    console.log("   ⚠️  Contract doesn't support updateVerifier - redeploying full contract...");

    // Deploy new PrivateTransferV4
    const newTransferContract = await PrivateTransferV4.deploy(
      transferVerifierAddress,
      oldConfig.claimVerifierAddress
    );
    await newTransferContract.waitForDeployment();
    const newTransferAddress = await newTransferContract.getAddress();
    console.log("   ✅ New PrivateTransferV4:", newTransferAddress);

    // Update config
    oldConfig.transferAddress = newTransferAddress;
  }

  // Update config with new verifier
  const newConfig = {
    ...oldConfig,
    transferVerifierAddress: transferVerifierAddress,
    version: "Phase 6 Monero-Style",
    deployed: new Date().toISOString()
  };

  // Save config
  fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  console.log("\n✅ Configuration updated:", configPath);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      PlonkVerifierPhase6: transferVerifierAddress,
      ClaimVerifier: oldConfig.claimVerifierAddress,
      PrivateTransferV4: oldConfig.transferAddress
    },
    config: newConfig
  };

  const deploymentPath = path.join(__dirname, `../deployments/phase6-verifier-update-${Date.now()}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved:", deploymentPath);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 PHASE 6 MONERO-STYLE VERIFIER DEPLOYED!");
  console.log("=".repeat(60));
  console.log("\n📝 New Addresses:");
  console.log("   PlonkVerifierPhase6:", transferVerifierAddress);
  console.log("   PrivateTransferV4:", oldConfig.transferAddress);
  console.log("   ClaimVerifier:", oldConfig.claimVerifierAddress);
  console.log("\n🔗 Verify on Etherscan:");
  console.log("   npx hardhat verify --network sepolia", transferVerifierAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
