const { buildPoseidon } = require('circomlibjs');

async function verifyKeyMismatch() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  console.log('🔍 Verifying Key Mismatch Issue\n');
  console.log('===================================\n');

  // From transfer logs - the values used during transfer
  const transferUsedRecipientViewPub = '12403249645028111319077074451544044941449478071570263768724153261704332862533';
  const ephemeralPublicKey = '9661821655729307970646064626584568760952169408139141783456347104606505717907';
  const stealthSalt = '6279215639558520567997810903751531826830813200476853362962442723356758462019';
  const transferAmount = '5';
  const expectedStealthAddress = '3586977961360010084648460159220984895013960146507773043488489721035853523216';

  console.log('📝 Values from Transfer:');
  console.log('   Recipient View Pub (entered manually):', transferUsedRecipientViewPub);
  console.log('   Ephemeral Public Key:', ephemeralPublicKey);
  console.log('   Expected Stealth Address:', expectedStealthAddress);
  console.log();

  // From localStorage - the view public key stored
  const storedViewPublicKey = '12403249645028111319077074451544044941449478071570263768724153261704332862533';
  console.log('📝 Value from localStorage:');
  console.log('   Stored View Public Key:', storedViewPublicKey);
  console.log();

  // Check if they match
  if (transferUsedRecipientViewPub === storedViewPublicKey) {
    console.log('✅ View public keys MATCH!');
    console.log('   This means the keys in localStorage are correct.');
    console.log();

    // If they match, let's verify the stealth address computation
    console.log('🧮 Computing stealth address with stored keys...');

    // Compute shared secret: Poseidon(recipientViewPub, ephemeralPub)
    const sharedSecretHash = poseidon([storedViewPublicKey, ephemeralPublicKey]);
    const sharedSecret = F.toString(sharedSecretHash);
    console.log('   Shared Secret:', sharedSecret);

    // Compute stealth address: Poseidon(sharedSecret, transferAmount, stealthSalt)
    const stealthAddressHash = poseidon([sharedSecret, transferAmount, stealthSalt]);
    const computedStealthAddress = F.toString(stealthAddressHash);
    console.log('   Computed Stealth Address:', computedStealthAddress);
    console.log('   Expected Stealth Address:', expectedStealthAddress);
    console.log();

    if (computedStealthAddress === expectedStealthAddress) {
      console.log('✅✅✅ SUCCESS! Stealth address matches!');
      console.log();
      console.log('This means the computation is CORRECT.');
      console.log('The issue must be in how the claim circuit is being called.');
    } else {
      console.log('❌ MISMATCH! Stealth addresses don\'t match!');
      console.log();
      console.log('Difference found:');
      console.log('   Expected:', expectedStealthAddress);
      console.log('   Computed:', computedStealthAddress);
    }
  } else {
    console.log('❌ View public keys DO NOT MATCH!');
    console.log('   This means the keys in localStorage are NOT the recipient keys.');
    console.log('   You need to use the RECIPIENT\'s private keys to claim.');
    console.log();
    console.log('📝 Solution:');
    console.log('   1. Find the recipient\'s view private key (the one used to generate', transferUsedRecipientViewPub + ')');
    console.log('   2. Import those keys into localStorage');
    console.log('   3. Try claiming again');
  }
}

verifyKeyMismatch().catch(console.error);
