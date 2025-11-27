// scripts/check-contract-balance.js
// Check actual ETH balance in old contract

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔍 Checking Old Contract Balance");
  console.log("═══════════════════════════════════════\n");

  const OLD_CONTRACT_ADDRESS = "0x4F1B427c1daD4cb54C950417B6D46FAb90309347";

  console.log("📍 Contract Address:", OLD_CONTRACT_ADDRESS);
  console.log("🔗 Etherscan:", `https://sepolia.etherscan.io/address/${OLD_CONTRACT_ADDRESS}`);
  console.log();

  // Get contract's actual ETH balance
  const balance = await ethers.provider.getBalance(OLD_CONTRACT_ADDRESS);
  const balanceInEth = ethers.formatEther(balance);

  console.log("💰 Total ETH in Contract:", balanceInEth, "ETH");
  console.log();

  if (balance > 0n) {
    console.log("⚠️  There is", balanceInEth, "ETH locked in the contract!");
    console.log("📋 Breakdown:");

    // Get contract instance to check individual balances
    const PrivateTransferV3 = await ethers.getContractFactory("PrivateTransferV3");
    const contract = PrivateTransferV3.attach(OLD_CONTRACT_ADDRESS);

    // Get signer address
    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    const yourBalance = await contract.getBalance(signerAddress);
    const yourBalanceInEth = ethers.formatEther(yourBalance);

    console.log("   Your tracked balance:", yourBalanceInEth, "ETH");
    console.log("   Other users/untracked:", ethers.formatEther(balance - yourBalance), "ETH");

    if (yourBalance > 0n) {
      console.log("\n💡 You can recover your", yourBalanceInEth, "ETH using the recover-funds.js script");
    }
  } else {
    console.log("✅ Contract has 0 ETH - nothing to recover");
  }

  console.log("═══════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
