const { buildPoseidon } = require('circomlibjs');

/**
 * Simulate the EXACT logic of the claim circuit
 * This should match claim.circom exactly
 */
async function simulateClaimCircuit() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  console.log('🔍 Simulating Full Claim Circuit Logic\n');
  console.log('===================================\n');

  // INPUTS (from decoded localStorage and transfer)
  const viewPrivateKey = '18121738103153297331458562396938868596892343497288752209371794674518311711892';
  const spendPrivateKey = '16520720981882993648236233880417912131198058497049583374393172034371559450457';
  const ephemeralPublicKey = '9661821655729307970646064626584568760952169408139141783456347104606505717907';
  const transferAmount = '5';
  const stealthSalt = '6279215639558520567997810903751531826830813200476853362962442723356758462019';
  const assetId = '1998';
  const expectedStealthAddress = '3586977961360010084648460159220984895013960146507773043488489721035853523216';

  console.log('📝 Circuit Inputs:');
  console.log('   viewPrivateKey:', viewPrivateKey);
  console.log('   spendPrivateKey:', spendPrivateKey);
  console.log('   ephemeralPublicKey:', ephemeralPublicKey);
  console.log('   transferAmount:', transferAmount);
  console.log('   stealthSalt:', stealthSalt);
  console.log('   assetId:', assetId);
  console.log();

  // ============================================
  // EXACTLY MATCH CLAIM.CIRCOM LOGIC
  // ============================================

  // Step 1: Derive view public key from private key
  // claim.circom:64-65
  // viewPublicKey = Poseidon(viewPrivateKey)
  console.log('Step 1: Derive view public key from private key');
  const viewPubHash = poseidon([BigInt(viewPrivateKey)]);
  const viewPublicKey = F.toString(viewPubHash);
  console.log('   viewPublicKey = Poseidon(viewPrivateKey)');
  console.log('   viewPublicKey:', viewPublicKey);
  console.log();

  // Step 2: Derive shared secret using view public key
  // claim.circom:70-72
  // sharedSecret = Poseidon(viewPublicKey, ephemeralPublicKey)
  console.log('Step 2: Derive shared secret');
  const sharedSecretHash = poseidon([BigInt(viewPublicKey), BigInt(ephemeralPublicKey)]);
  const sharedSecret = F.toString(sharedSecretHash);
  console.log('   sharedSecret = Poseidon(viewPublicKey, ephemeralPublicKey)');
  console.log('   sharedSecret:', sharedSecret);
  console.log();

  // Step 3: Recompute stealth address
  // claim.circom:76-79
  // stealthAddress = Poseidon(sharedSecret, transferAmount, stealthSalt)
  console.log('Step 3: Recompute stealth address');
  const stealthAddressHash = poseidon([BigInt(sharedSecret), BigInt(transferAmount), BigInt(stealthSalt)]);
  const computedStealthAddress = F.toString(stealthAddressHash);
  console.log('   stealthAddress = Poseidon(sharedSecret, transferAmount, stealthSalt)');
  console.log('   computedStealthAddress:', computedStealthAddress);
  console.log();

  // Step 4: Verify
  console.log('Step 4: Verify stealth address match');
  console.log('   Expected Stealth Address:', expectedStealthAddress);
  console.log('   Computed Stealth Address:', computedStealthAddress);
  console.log();

  if (computedStealthAddress === expectedStealthAddress) {
    console.log('✅✅✅ SUCCESS! Circuit simulation produces correct stealth address!');
    console.log();
    console.log('This means:');
    console.log('   1. The keys are correct');
    console.log('   2. The circuit logic is correct');
    console.log('   3. The computation process is correct');
    console.log();
    console.log('🔍 NEXT STEP: Check what the actual circuit received as inputs');
    console.log('   Look at the backend logs during claim proof generation');
    console.log('   The claimProver.js logs all inputs at lines 44-50');
  } else {
    console.log('❌ MISMATCH! Circuit simulation produces WRONG stealth address!');
    console.log();
    console.log('Difference found at:');
    console.log('   Expected:', expectedStealthAddress);
    console.log('   Computed:', computedStealthAddress);
    console.log();
    console.log('This would indicate a logic error in either:');
    console.log('   1. The claim circuit implementation');
    console.log('   2. This simulation script');
  }

  console.log();
  console.log('📊 Summary:');
  console.log('   viewPrivateKey:', viewPrivateKey.substring(0, 20) + '...');
  console.log('   viewPublicKey:', viewPublicKey);
  console.log('   ephemeralPublicKey:', ephemeralPublicKey);
  console.log('   sharedSecret:', sharedSecret);
  console.log('   transferAmount:', transferAmount);
  console.log('   stealthSalt:', stealthSalt.substring(0, 20) + '...');
  console.log('   computedStealthAddress:', computedStealthAddress);
  console.log('   expectedStealthAddress:', expectedStealthAddress);
  console.log('   Match:', computedStealthAddress === expectedStealthAddress ? 'YES' : 'NO');
}

simulateClaimCircuit().catch(console.error);
