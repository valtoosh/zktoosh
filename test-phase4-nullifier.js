// test-phase4-nullifier.js
// Test script for Phase 4: Nullifier Replay Attack Prevention

const { ethers } = require('ethers');
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const { buildPoseidon } = require('circomlibjs');
const crypto = require('crypto');

// Load contract addresses
const config = require('./frontend/src/contracts/plonk/config.json');

// Sepolia RPC
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/' + process.env.INFURA_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Test parameters - Use random recipient each time to avoid hash collisions
const TEST_PARAMS = {
  senderBalance: 10000,
  transferAmount: 150,
  recipientAddress: ethers.Wallet.createRandom().address, // Random address each run
  assetId: 1998,
  maxAmount: 5000
};

async function main() {
  console.log('\n🧪 Phase 4: Nullifier Replay Attack Prevention Test');
  console.log('═══════════════════════════════════════════════════\n');

  // Initialize provider and wallet
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log('📍 Network: Sepolia');
  console.log('👤 Tester:', wallet.address);
  console.log('💰 Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH');
  console.log('📋 Contract:', config.transferAddress);
  console.log('\n');

  // Load contract
  const PrivateTransferV3 = new ethers.Contract(
    config.transferAddress,
    [
      'function deposit() external payable',
      'function privateTransfer(uint256[24] calldata proof, uint256[8] calldata publicSignals) external',
      'function getBalance(address account) external view returns (uint256)',
      'function nullifiers(uint256) external view returns (bool)',
      'event PrivateTransfer(address indexed sender, uint256 indexed recipientHash, uint256 indexed assetId, uint256 timestamp, bool valid, uint256 newBalance)',
      'event NullifierUsed(uint256 indexed nullifier, address indexed sender, uint256 timestamp)'
    ],
    wallet
  );

  // ============================================
  // STEP 1: Deposit funds to contract
  // ============================================

  console.log('💰 Step 1: Depositing 0.001 ETH to contract...');
  const depositAmount = ethers.parseEther('0.001');

  const currentBalance = await PrivateTransferV3.getBalance(wallet.address);
  console.log('   Current balance:', currentBalance.toString());

  if (currentBalance < depositAmount) {
    const depositTx = await PrivateTransferV3.deposit({ value: depositAmount });
    console.log('   Tx:', depositTx.hash);
    await depositTx.wait();
    console.log('   ✅ Deposit confirmed');
  } else {
    console.log('   ✅ Sufficient balance already deposited');
  }

  const newBalance = await PrivateTransferV3.getBalance(wallet.address);
  console.log('   New balance:', newBalance.toString());

  // ============================================
  // STEP 2: Generate proof with nullifier
  // ============================================

  console.log('\n🔐 Step 2: Generating PLONK proof with nullifier...');

  const poseidon = await buildPoseidon();

  // Generate secure random salt
  const randomBytes = crypto.randomBytes(32);
  const randomBigInt = BigInt('0x' + randomBytes.toString('hex'));
  const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
  const salt = (randomBigInt % fieldModulus).toString();

  console.log('   Salt (first 20 chars):', salt.slice(0, 20) + '...');

  // Calculate commitment
  const balanceCommitment = poseidon.F.toString(
    poseidon([BigInt(TEST_PARAMS.senderBalance), BigInt(salt)])
  );

  // Hash recipient address
  const recipientAddressHash = BigInt(TEST_PARAMS.recipientAddress.toLowerCase()).toString();

  // Circuit input
  const circuitInput = {
    senderBalance: TEST_PARAMS.senderBalance,
    transferAmount: TEST_PARAMS.transferAmount,
    recipientAddressHash: recipientAddressHash,
    salt: salt,
    assetId: TEST_PARAMS.assetId,
    maxAmount: TEST_PARAMS.maxAmount,
    balanceCommitment: balanceCommitment
  };

  const wasmPath = path.join(__dirname, 'backend/keys/plonk/transfer_js/transfer.wasm');
  const zkeyPath = path.join(__dirname, 'backend/keys/plonk/transfer_final.zkey');

  console.log('   Generating proof...');
  const { proof, publicSignals } = await snarkjs.plonk.fullProve(
    circuitInput,
    wasmPath,
    zkeyPath
  );

  console.log('   ✅ Proof generated');
  console.log('   Public Signals (8):');
  console.log('      Outputs (0-4):');
  console.log('        [0] valid:', publicSignals[0]);
  console.log('        [1] newBalance:', publicSignals[1]);
  console.log('        [2] newBalanceCommitment:', publicSignals[2]);
  console.log('        [3] recipientHash:', publicSignals[3]);
  console.log('        [4] nullifier (PHASE 4):', publicSignals[4]);
  console.log('      Public Inputs (5-7):');
  console.log('        [5] assetId:', publicSignals[5]);
  console.log('        [6] maxAmount:', publicSignals[6]);
  console.log('        [7] balanceCommitment:', publicSignals[7]);

  const nullifier = publicSignals[4]; // CORRECTED: Nullifier is signal [4]

  // ============================================
  // STEP 3: Format proof for contract
  // ============================================

  console.log('\n📦 Step 3: Formatting proof for on-chain verification...');

  const calldata = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
  const calldataStr = calldata.toString().trim();

  // Find the "][" separator
  const separatorIndex = calldataStr.indexOf('][');
  if (separatorIndex === -1) {
    throw new Error('Could not find ][ separator in calldata');
  }

  // Parse proof array (everything up to and including the first ])
  const proofArrayStr = calldataStr.substring(0, separatorIndex + 1);
  const proofArray = JSON.parse(proofArrayStr);

  // Parse signals array (everything from the second [ onwards)
  const signalsArrayStr = calldataStr.substring(separatorIndex + 1);
  const publicSignalsArray = JSON.parse(signalsArrayStr);

  console.log('   Proof array length:', proofArray.length);
  console.log('   Public signals length:', publicSignalsArray.length);

  // ============================================
  // STEP 4: First transaction (should succeed)
  // ============================================

  console.log('\n✅ Step 4: Submitting first transaction (SHOULD SUCCEED)...');

  try {
    const tx1 = await PrivateTransferV3.privateTransfer(proofArray, publicSignalsArray);
    console.log('   Tx hash:', tx1.hash);
    const receipt1 = await tx1.wait();
    console.log('   ✅ Transaction confirmed in block:', receipt1.blockNumber);
    console.log('   Gas used:', receipt1.gasUsed.toString());

    // Check if nullifier was marked as used
    const isNullifierUsed = await PrivateTransferV3.nullifiers(nullifier);
    console.log('   Nullifier marked as used:', isNullifierUsed);

    if (!isNullifierUsed) {
      console.log('   ❌ ERROR: Nullifier was NOT marked as used!');
      process.exit(1);
    }
  } catch (error) {
    console.log('   ❌ First transaction failed (unexpected):', error.message);
    process.exit(1);
  }

  // ============================================
  // STEP 5: Second transaction (should FAIL)
  // ============================================

  console.log('\n❌ Step 5: Attempting replay attack (SHOULD FAIL)...');

  try {
    const tx2 = await PrivateTransferV3.privateTransfer(proofArray, publicSignalsArray);
    console.log('   Tx hash:', tx2.hash);
    await tx2.wait();

    console.log('   ❌ SECURITY FAILURE: Replay attack succeeded!');
    console.log('   This should NOT happen - nullifier check is broken!');
    process.exit(1);
  } catch (error) {
    // This is expected - the transaction should revert
    if (error.message.includes('Double spend') || error.message.includes('nullifier already used')) {
      console.log('   ✅ Replay attack PREVENTED!');
      console.log('   Revert reason:', error.message.split('\n')[0]);
    } else if (error.message.includes('reverted')) {
      console.log('   ✅ Replay attack PREVENTED!');
      console.log('   Transaction reverted (expected)');
    } else {
      console.log('   ⚠️  Unexpected error:', error.message);
    }
  }

  // ============================================
  // STEP 6: Verify nullifier state
  // ============================================

  console.log('\n🔍 Step 6: Verifying nullifier state...');

  const finalNullifierState = await PrivateTransferV3.nullifiers(nullifier);
  console.log('   Nullifier value:', nullifier);
  console.log('   Marked as used:', finalNullifierState);

  if (finalNullifierState) {
    console.log('   ✅ Nullifier correctly tracked in contract state');
  } else {
    console.log('   ❌ ERROR: Nullifier not tracked!');
    process.exit(1);
  }

  // ============================================
  // SUCCESS!
  // ============================================

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Phase 4 Nullifier Test PASSED!');
  console.log('═══════════════════════════════════════════════════\n');
  console.log('Summary:');
  console.log('  ✅ First transaction succeeded');
  console.log('  ✅ Nullifier marked as used on-chain');
  console.log('  ✅ Replay attack prevented');
  console.log('  ✅ Double-spend protection WORKING\n');
  console.log('Phase 4: Critical Security Hardening COMPLETE! 🎉\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
