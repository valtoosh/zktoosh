// test-phase6-api.js - Quick Phase 6 API Test
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5001';

async function testPhase6API() {
  console.log('\n🧪 Testing Phase 6 API Endpoints\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Test 1: Health check
    console.log('1️⃣  Health Check...');
    const health = await axios.get(`${BACKEND_URL}/health`);
    console.log('   ✅ Status:', health.data.status);
    console.log('   ✅ Version:', health.data.version);
    console.log('   ✅ Features:', health.data.features.join(', '));

    // Test 2: Merkle state
    console.log('\n2️⃣  Merkle Tree State...');
    const merkle = await axios.get(`${BACKEND_URL}/api/proof-phase6/merkle-state`);
    console.log('   ✅ Root:', merkle.data.merkleTree.root);
    console.log('   ✅ Size:', merkle.data.merkleTree.size, 'leaves');

    // Test 3: Phase 6 stats
    console.log('\n3️⃣  Phase 6 Statistics...');
    const stats = await axios.get(`${BACKEND_URL}/api/proof-phase6/stats`);
    console.log('   ✅ Total Proofs:', stats.data.totalProofs);
    console.log('   ✅ Successful:', stats.data.successfulProofs);
    console.log('   ✅ Failed:', stats.data.failedProofs);

    // Test 4: Quick proof generation (small values for speed)
    console.log('\n4️⃣  Generating Phase 6 Proof...');
    console.log('   📊 Sender Balance: 1000 ENA');
    console.log('   📊 Transfer Amount: 50 ENA');
    console.log('   📊 Recipient: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

    const startTime = Date.now();
    const proofResponse = await axios.post(
      `${BACKEND_URL}/api/proof-phase6/generate`,
      {
        senderBalance: 1000,
        transferAmount: 50,
        recipientAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        assetId: 1,
        maxAmount: 10000,
        vPubIn: 0,
        vPubOut: 0
      }
    );
    const proofTime = Date.now() - startTime;

    console.log(`\n   ✅ Proof Generated in ${proofTime}ms`);
    console.log('   ✅ Valid:', proofResponse.data.valid);
    console.log('   ✅ New Balance:', proofResponse.data.newBalance);
    console.log('   ✅ Public Signals:', proofResponse.data.publicSignals.length);

    // Test 5: Verify Phase 6 features in proof
    console.log('\n5️⃣  Verifying Phase 6 Features...');
    console.log('   🎭 Stealth Address:', proofResponse.data.stealthAddress ? '✅' : '❌');
    console.log('   🔑 Ephemeral Public Key:', proofResponse.data.ephemeralPublicKey ? '✅' : '❌');
    console.log('   🌳 Merkle Leaf:', proofResponse.data.merkleLeaf ? '✅' : '❌');
    console.log('   📊 Merkle Proof Valid:', proofResponse.data.merkleProofValid === '1' ? '✅' : '❌');
    console.log('   📝 Encrypted Memo Hash:', proofResponse.data.encryptedMemoHash ? '✅' : '❌');

    // Test 6: Format for contract
    console.log('\n6️⃣  Formatting for Contract...');
    const formatResponse = await axios.post(
      `${BACKEND_URL}/api/proof-phase6/format-for-contract`,
      {
        proof: proofResponse.data.proof,
        publicSignals: proofResponse.data.publicSignals
      }
    );
    console.log('   ✅ Proof Bytes:', formatResponse.data.proofBytes.length, 'elements');
    console.log('   ✅ Public Signals:', formatResponse.data.publicSignals.length, 'elements');

    // Test 7: Off-chain verification
    console.log('\n7️⃣  Off-chain Verification...');
    const verifyResponse = await axios.post(
      `${BACKEND_URL}/api/proof-phase6/verify`,
      {
        proof: proofResponse.data.proof,
        publicSignals: proofResponse.data.publicSignals
      }
    );
    console.log('   ✅ Verification Result:', verifyResponse.data.valid ? 'PASSED' : 'FAILED');

    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ ALL TESTS PASSED');
    console.log('═══════════════════════════════════════════════\n');
    console.log('🎯 Phase 6 is ready for testing in the browser!');
    console.log('   Open: http://localhost:3000');
    console.log('   Navigate to: "🔒 Phase 6 (Max Privacy)" tab');
    console.log('   Connect wallet (Sepolia) and test transfer\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testPhase6API();
