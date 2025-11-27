// scripts/recover-funds.js
// Script to recover funds from old contract deployment

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("\n💰 Fund Recovery Script");
  console.log("═══════════════════════════════════════\n");

  // Get signer
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("👤 Your Address:", signerAddress);

  // Old contract address (from PHASE5_FIX_SUMMARY.md)
  const OLD_CONTRACT_ADDRESS = "0x4F1B427c1daD4cb54C950417B6D46FAb90309347";

  console.log("📍 Old Contract:", OLD_CONTRACT_ADDRESS);
  console.log();

  // Get contract instance
  const PrivateTransferV3 = await ethers.getContractFactory("PrivateTransferV3");
  const oldContract = PrivateTransferV3.attach(OLD_CONTRACT_ADDRESS);

  // Check your balance in the old contract
  const balance = await oldContract.getBalance(signerAddress);
  const balanceInEth = ethers.formatEther(balance);

  console.log("💵 Your Balance in Old Contract:", balanceInEth, "ETH");

  if (balance === 0n) {
    console.log("✅ No funds to recover - balance is 0");
    return;
  }

  console.log("\n⚠️  Found", balanceInEth, "ETH to recover!");
  console.log("🔄 Initiating withdrawal...\n");

  // Call withdraw function
  try {
    const tx = await oldContract.withdraw(
      balance,           // amount to withdraw
      signerAddress,     // recipient (yourself)
      {
        gasLimit: 500000 // Set gas limit to ensure transaction succeeds
      }
    );

    console.log("📤 Withdrawal transaction sent:", tx.hash);
    console.log("⏳ Waiting for confirmation...");

    const receipt = await tx.wait();

    console.log("\n✅ Withdrawal Successful!");
    console.log("═══════════════════════════════════════");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Transaction:", `https://sepolia.etherscan.io/tx/${tx.hash}`);
    console.log("\n💰 Recovered:", balanceInEth, "ETH");
    console.log("═══════════════════════════════════════\n");

  } catch (error) {
    console.error("\n❌ Withdrawal failed:", error.message);

    if (error.message.includes("Insufficient balance")) {
      console.log("💡 This usually means the balance was already withdrawn");
    } else if (error.message.includes("paused")) {
      console.log("💡 Contract is paused - contact owner to unpause");
    } else {
      console.log("\n🔍 Full error:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
