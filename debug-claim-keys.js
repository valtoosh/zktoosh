const { buildPoseidon } = require('circomlibjs');

async function debugStealthAddress() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  console.log('🔍 Debug Stealth Address Computation\n');
  console.log('Enter your values below to compute what stealth address SHOULD be:\n');

  // Known correct values from transfer
  const ephemeralPublicKey = '9661821655729307970646064626584568760952169408139141783456347104606505717907';
  const stealthSalt = '6279215639558520567997810903751531826830813200476853362962442723356758462019';
  const transferAmount = '5';
  const expectedStealthAddress = '3586977961360010084648460159220984895013960146507773043488489721035853523216';

  console.log('✅ Known values from transfer:');
  console.log('   Ephemeral Public Key:', ephemeralPublicKey);
  console.log('   Stealth Salt:', stealthSalt);
  console.log('   Transfer Amount:', transferAmount);
  console.log('   Expected Stealth Address:', expectedStealthAddress);
  console.log();

  // YOU NEED TO PROVIDE YOUR VIEW PRIVATE KEY
  console.log('⚠️  You need to provide your viewPrivateKey from localStorage!');
  console.log('   Check browser DevTools → Application → Local Storage');
  console.log('   Look for: zkphase6_viewPrivateKey');
  console.log();
  console.log('Then modify this script and run: node debug-claim-keys.js');
  console.log();

  // REPLACE THIS WITH YOUR ACTUAL VIEW PRIVATE KEY FROM LOCALSTORAGE:
  const viewPrivateKey = 'YOUR_VIEW_PRIVATE_KEY_HERE';

  if (viewPrivateKey === 'YOUR_VIEW_PRIVATE_KEY_HERE') {
    console.log('❌ Please edit this file and replace YOUR_VIEW_PRIVATE_KEY_HERE with your actual key!');
    process.exit(1);
  }

  // Compute view public key
  const viewPubKeyHash = poseidon([viewPrivateKey]);
  const viewPublicKey = F.toString(viewPubKeyHash);
  console.log('📊 Computed from your viewPrivateKey:');
  console.log('   View Public Key:', viewPublicKey);
  console.log();

  // Compute shared secret
  const sharedSecretHash = poseidon([viewPublicKey, ephemeralPublicKey]);
  const sharedSecret = F.toString(sharedSecretHash);
  console.log('   Shared Secret:', sharedSecret);
  console.log();

  // Compute stealth address
  const stealthAddressHash = poseidon([sharedSecret, transferAmount, stealthSalt]);
  const computedStealthAddress = F.toString(stealthAddressHash);
  console.log('   Computed Stealth Address:', computedStealthAddress);
  console.log();

  // Check if they match
  if (computedStealthAddress === expectedStealthAddress) {
    console.log('✅ SUCCESS! Your viewPrivateKey is CORRECT!');
    console.log('   The stealth address matches!');
    console.log();
    console.log('   This means you should be able to claim with these keys.');
    console.log('   Make sure you\'re also using the matching spendPrivateKey.');
  } else {
    console.log('❌ MISMATCH! Your viewPrivateKey is WRONG!');
    console.log('   Expected:', expectedStealthAddress);
    console.log('   Computed:', computedStealthAddress);
    console.log();
    console.log('   You need to find the CORRECT viewPrivateKey that was used during the transfer.');
    console.log('   Check your localStorage or the transfer transaction details.');
  }
}

debugStealthAddress().catch(console.error);
