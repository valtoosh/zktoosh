// scripts/verify-contracts.js
// Verify deployed contracts on Etherscan

const hre = require("hardhat");

async function main() {
  console.log("\n🔍 Verifying Contracts on Etherscan");
  console.log("═══════════════════════════════════════\n");

  // Contract addresses from latest deployment
  const VERIFIER_ADDRESS = "0x08D3F624f7f40b6418dc4D533b1207fA1B72fAcA";
  const TRANSFER_ADDRESS = "0xC2E01A52d551bcF11Ac95F6266f5ad23c82574Ff";

  console.log("📍 PlonkVerifier:", VERIFIER_ADDRESS);
  console.log("📍 PrivateTransferV3:", TRANSFER_ADDRESS);
  console.log();

  try {
    // Verify PlonkVerifier
    console.log("🔄 Verifying PlonkVerifier...");
    await hre.run("verify:verify", {
      address: VERIFIER_ADDRESS,
      constructorArguments: [],
      contract: "contracts/plonk/PlonkVerifier.sol:PlonkVerifier"
    });
    console.log("✅ PlonkVerifier verified!\n");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ PlonkVerifier already verified\n");
    } else {
      console.log("❌ PlonkVerifier verification failed:", error.message, "\n");
    }
  }

  try {
    // Verify PrivateTransferV3
    console.log("🔄 Verifying PrivateTransferV3...");
    await hre.run("verify:verify", {
      address: TRANSFER_ADDRESS,
      constructorArguments: [VERIFIER_ADDRESS],
      contract: "contracts/plonk/PrivateTransferV3.sol:PrivateTransferV3"
    });
    console.log("✅ PrivateTransferV3 verified!\n");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ PrivateTransferV3 already verified\n");
    } else {
      console.log("❌ PrivateTransferV3 verification failed:", error.message, "\n");
    }
  }

  console.log("═══════════════════════════════════════");
  console.log("🔗 View on Etherscan:");
  console.log("   Verifier:", `https://sepolia.etherscan.io/address/${VERIFIER_ADDRESS}#code`);
  console.log("   Transfer:", `https://sepolia.etherscan.io/address/${TRANSFER_ADDRESS}#code`);
  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
