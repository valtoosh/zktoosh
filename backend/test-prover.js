// backend/test-prover.js
const plonkProver = require('./src/services/plonkProver');

async function test() {
  console.log('🧪 Testing PLONK Prover directly...\n');
  
  const input = {
    senderBalance: 6000,
    transferAmount: 95,
    recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    assetId: 1998,
    maxAmount: 12000
  };

  // DEBUG: Check the actual value
  console.log('DEBUG: Input object:', JSON.stringify(input, null, 2));
  console.log('DEBUG: recipientAddress value:', input.recipientAddress);
  console.log('DEBUG: recipientAddress type:', typeof input.recipientAddress);
  console.log('DEBUG: recipientAddress length:', input.recipientAddress.length);
  console.log('DEBUG: Regex test:', /^0x[0-9a-fA-F]{40}$/.test(input.recipientAddress));
  console.log();

  try {
    const result = await plonkProver.generateProof(input);
    console.log('\n✅ SUCCESS!');
    console.log('Valid:', result.valid);
    console.log('New Balance:', result.newBalance);
    console.log('Generation Time:', result.generationTime + 'ms');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

test();