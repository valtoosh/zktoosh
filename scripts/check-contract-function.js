// Check if new contract has correct claimTransfer signature
const { ethers } = require('ethers');
const PrivateTransferV3Artifact = require('../frontend/src/contracts/plonk/PrivateTransferV3.json');
const contractConfig = require('../frontend/src/contracts/plonk/config.json');

async function checkContractFunction() {
  console.log('\n🔍 Checking Contract Function Signature');
  console.log('=========================================');
  console.log('Contract:', contractConfig.transferAddress);
  console.log('');

  // Connect to Sepolia
  const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org');

  const contract = new ethers.Contract(
    contractConfig.transferAddress,
    PrivateTransferV3Artifact.abi,
    provider
  );

  console.log('📋 Checking claimTransfer function...');

  try {
    // Get function fragment
    const func = contract.interface.getFunction('claimTransfer');
    console.log('\n✅ Function found:', func.name);
    console.log('📊 Parameters:');

    func.inputs.forEach((input, i) => {
      console.log(`  [${i}] ${input.name}: ${input.type}`);
    });

    console.log('\n✅ Expected signature: claimTransfer(uint256 recipientHash, uint256 amount)');

    if (func.inputs.length === 2) {
      console.log('✅ Contract has CORRECT signature (2 parameters)');
      console.log('✅ Fix is deployed!');
    } else if (func.inputs.length === 1) {
      console.log('❌ Contract has OLD signature (1 parameter)');
      console.log('❌ Need to redeploy with fix');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkContractFunction();
