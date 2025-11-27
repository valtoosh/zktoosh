// scripts/emergency-recover.js
// Emergency recovery for stuck ETH in old contract
// This will attempt to recover ETH by calling the contract directly

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚨 Emergency Fund Recovery");
  console.log("═══════════════════════════════════════\n");

  const OLD_CONTRACT_ADDRESS = "0x4F1B427c1daD4cb54C950417B6D46FAb90309347";

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("👤 Your Address:", signerAddress);
  console.log("📍 Old Contract:", OLD_CONTRACT_ADDRESS);
  console.log();

  // Get contract instance
  const PrivateTransferV3 = await ethers.getContractFactory("PrivateTransferV3");
  const contract = PrivateTransferV3.attach(OLD_CONTRACT_ADDRESS);

  // Check if you're the owner
  const owner = await contract.owner();
  console.log("👑 Contract Owner:", owner);
  console.log("✅ You are the owner:", owner.toLowerCase() === signerAddress.toLowerCase());
  console.log();

  // Check contract balance
  const contractBalance = await ethers.provider.getBalance(OLD_CONTRACT_ADDRESS);
  console.log("💰 Contract Balance:", ethers.formatEther(contractBalance), "ETH");

  // Check your tracked balance
  const yourBalance = await contract.getBalance(signerAddress);
  console.log("📊 Your Tracked Balance:", ethers.formatEther(yourBalance), "ETH");
  console.log();

  if (contractBalance === 0n) {
    console.log("✅ No ETH in contract - nothing to recover");
    return;
  }

  console.log("════════════════════════════════════════");
  console.log("⚠️  SITUATION ANALYSIS");
  console.log("════════════════════════════════════════");
  console.log("Contract has:", ethers.formatEther(contractBalance), "ETH");
  console.log("Your tracked balance:", ethers.formatEther(yourBalance), "ETH");
  console.log("Untracked ETH:", ethers.formatEther(contractBalance - yourBalance), "ETH");
  console.log();

  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    console.log("❌ You are not the owner - cannot perform emergency recovery");
    console.log("💡 Only the contract owner can recover untracked funds");
    return;
  }

  console.log("════════════════════════════════════════");
  console.log("🔧 RECOVERY OPTIONS");
  console.log("════════════════════════════════════════\n");

  console.log("Unfortunately, this contract doesn't have an emergency withdrawal");
  console.log("function for the owner to recover untracked ETH.");
  console.log();
  console.log("💡 EXPLANATION:");
  console.log("The 0.3 ETH is stuck because:");
  console.log("1. You sent ETH with a transaction");
  console.log("2. The transaction succeeded (ETH was sent)");
  console.log("3. But the contract function reverted");
  console.log("4. ETH stayed in contract but wasn't tracked in balances mapping");
  console.log();
  console.log("🔍 WHAT LIKELY HAPPENED:");
  console.log("The deposit transaction included msg.value but the function");
  console.log("wasn't marked 'payable', so the transaction may have partially");
  console.log("executed or the ETH entered via the receive() fallback.");
  console.log();
  console.log("📋 TO RECOVER:");
  console.log("1. Check Etherscan transaction history for the deposit");
  console.log("2. The ETH might actually be tracked under a different address");
  console.log("3. Or it entered via receive() and should be in your balance");
  console.log();
  console.log("🔗 Check transactions: https://sepolia.etherscan.io/address/" + OLD_CONTRACT_ADDRESS);
  console.log();

  // Let's try one more thing - check if the balance was somehow credited
  console.log("🔄 Attempting standard withdrawal of tracked balance...\n");

  if (yourBalance > 0n) {
    try {
      const tx = await contract.withdraw(yourBalance, signerAddress, {
        gasLimit: 500000
      });

      console.log("📤 Transaction sent:", tx.hash);
      await tx.wait();
      console.log("✅ Recovered", ethers.formatEther(yourBalance), "ETH!");
    } catch (error) {
      console.log("❌ Withdrawal failed:", error.message);
    }
  } else {
    console.log("❌ Your tracked balance is 0 - nothing to withdraw");
    console.log();
    console.log("🤔 The ETH might be lost unless:");
    console.log("   - It was deposited by someone else");
    console.log("   - The transaction actually reverted and ETH was returned");
    console.log("   - You can deploy a contract upgrade with recovery function");
  }

  console.log("\n═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
