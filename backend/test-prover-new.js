const plonkProver = require('./src/services/plonkProver');

async function test() {
  console.log('🧪 Testing PLONK Prover with VALID address...\n');
  
  const input = {
    senderBalance: 6000,
    transferAmount: 95,
    recipientAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    assetId: 1998,
    maxAmount: 12000
  };

  console.log('Testing with address:', input.recipientAddress);
  console.log('Length:', input.recipientAddress.length);
  console.log();

  try {
    const result = await plonkProver.generateProof(input);
    console.log('\n✅ SUCCESS!');
    console.log('Valid:', result.valid);
    console.log('New Balance:', result.newBalance);
    console.log('Time:', result.generationTime + 'ms');
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

test();
