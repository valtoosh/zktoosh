// Test claim circuit with exact values from the transfer
const { buildPoseidon } = require('circomlibjs');

async function test() {
  const poseidon = await buildPoseidon();

  // Values from the transfer
  const viewPrivateKey = BigInt('19831871554947774569075730202897526548091014634613461723991282192735995627586');
  const spendPrivateKey = BigInt('5327351099395928923876604067224421155108548391410688526975120369658029402883');
  const ephemeralPublicKey = BigInt('1060773558083359942075463593252829203635562096759712846615219437775288628210');
  const transferAmount = BigInt('3');
  const stealthSalt = BigInt('2212464869673892803239731685220361502875089909590391600854963322308340270141');
  const assetId = BigInt('1998');
  const stealthAddress = BigInt('12049997090691505396566793744223582168129485848081847023420518082286091819685');

  console.log('📋 Input values:');
  console.log('  viewPrivateKey:', viewPrivateKey.toString());
  console.log('  spendPrivateKey:', spendPrivateKey.toString());
  console.log('  ephemeralPublicKey:', ephemeralPublicKey.toString());
  console.log('  transferAmount:', transferAmount.toString());
  console.log('  stealthSalt:', stealthSalt.toString());
  console.log('  assetId:', assetId.toString());
  console.log('  stealthAddress:', stealthAddress.toString());
  console.log('');

  // Step 1: Derive view public key from private key
  const viewPublicKey = poseidon.F.toObject(poseidon([viewPrivateKey]));
  console.log('✅ Step 1: viewPublicKey =', viewPublicKey.toString());

  // Step 2: Derive shared secret
  const sharedSecret = poseidon.F.toObject(poseidon([viewPublicKey, ephemeralPublicKey]));
  console.log('✅ Step 2: sharedSecret =', sharedSecret.toString());

  // Step 3: Recompute stealth address
  const computedStealthAddress = poseidon.F.toObject(poseidon([sharedSecret, transferAmount, stealthSalt]));
  console.log('✅ Step 3: computedStealthAddress =', computedStealthAddress.toString());
  console.log('           expectedStealthAddress  =', stealthAddress.toString());
  console.log('           Match:', computedStealthAddress.toString() === stealthAddress.toString() ? '✅ YES' : '❌ NO');
  console.log('');

  // Step 4: Generate claimer address hash
  const claimerAddressHash = poseidon.F.toObject(poseidon([viewPrivateKey, spendPrivateKey]));
  console.log('✅ Step 4: claimerAddressHash =', claimerAddressHash.toString());

  // Step 5: Check if computed stealth address matches
  const addressValid = computedStealthAddress.toString() === stealthAddress.toString() ? 1 : 0;
  const amountValid = transferAmount > 0 ? 1 : 0;
  const valid = addressValid * amountValid;

  console.log('✅ Step 5: valid =', valid);
  console.log('');

  // Expected public signals
  console.log('📊 EXPECTED Public Signals (what circuit SHOULD output):');
  console.log('  [0] assetId:', assetId.toString());
  console.log('  [1] stealthAddress:', stealthAddress.toString());
  console.log('  [2] valid:', valid);
  console.log('  [3] claimerAddressHash:', claimerAddressHash.toString());
  console.log('  [4] claimedAmount:', transferAmount.toString());
}

test().catch(console.error);
