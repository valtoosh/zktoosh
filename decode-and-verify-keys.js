const { buildPoseidon } = require('circomlibjs');

// Simple base64 decode function
function decodeKey(encodedKey) {
  const decoded = Buffer.from(encodedKey, 'base64').toString('utf8');
  // The decoded value might need further processing
  // Let's try to extract the numeric value
  console.log('Raw decoded:', decoded);

  // Try to extract numbers from the decoded string
  const numbers = decoded.match(/\d+/g);
  if (numbers && numbers.length > 0) {
    return numbers[0];
  }

  // If that doesn't work, try converting each character
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    const code = decoded.charCodeAt(i);
    if (code >= 48 && code <= 57) { // 0-9
      result += decoded[i];
    }
  }

  if (result) return result;

  // Last resort: convert the entire string to a big number
  let bigNum = BigInt(0);
  for (let i = 0; i < decoded.length; i++) {
    bigNum = bigNum * BigInt(256) + BigInt(decoded.charCodeAt(i));
  }
  return bigNum.toString();
}

async function verifyKeys() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  console.log('🔍 Decoding and Verifying Your Keys\n');

  // Your encoded keys from localStorage
  const encodedViewPriv = 'XVdSU11fXEtFfVxLXF9eWBgGHQEUHXVUVVtdTVlKWwMYf1ZBXFoYdFNQFHxnGW8SCQhoBAdtBxATdkFHVVFhUlZ+WEwcBAIAHwIOGRo=';
  const encodedSpendPriv = 'XVlWU1xfXUNNdV5CUV5VWBwDGggSG3tTUFpWTF9HWQwZeFxFVl0RdFlTFXdnGW8QBQlqCQZsAB0TeENBW1dnVlZ4XkUaAAoDGwMCFR8=';
  const storedViewPub = '12403249645028111319077074451544044941449478071570263768724153261704332862533';

  console.log('📝 Your keys from localStorage:');
  console.log('   View Private Key (encoded):', encodedViewPriv);
  console.log('   Spend Private Key (encoded):', encodedSpendPriv);
  console.log('   View Public Key:', storedViewPub);
  console.log();

  // Try to decode
  console.log('🔓 Attempting to decode...');

  try {
    const decodedView = decodeKey(encodedViewPriv);
    const decodedSpend = decodeKey(encodedSpendPriv);

    console.log('   Decoded View Priv:', decodedView.substring(0, 50), '...');
    console.log('   Decoded Spend Priv:', decodedSpend.substring(0, 50), '...');
    console.log();

    // Verify view public key
    console.log('🧮 Verifying view public key...');
    const computedViewPubHash = poseidon([decodedView]);
    const computedViewPub = F.toString(computedViewPubHash);

    console.log('   Computed View Pub:', computedViewPub);
    console.log('   Stored View Pub:', storedViewPub);

    if (computedViewPub === storedViewPub) {
      console.log('   ✅ MATCH! View key decoded correctly!');
      console.log();

      // Now compute stealth address
      const ephemeralPublicKey = '9661821655729307970646064626584568760952169408139141783456347104606505717907';
      const stealthSalt = '6279215639558520567997810903751531826830813200476853362962442723356758462019';
      const transferAmount = '5';
      const expectedStealthAddress = '3586977961360010084648460159220984895013960146507773043488489721035853523216';

      console.log('🎯 Computing stealth address...');
      console.log('   Using:');
      console.log('     View Pub:', computedViewPub);
      console.log('     Ephemeral Pub:', ephemeralPublicKey);
      console.log('     Transfer Amount:', transferAmount);
      console.log('     Stealth Salt:', stealthSalt);
      console.log();

      // Compute shared secret
      const sharedSecretHash = poseidon([computedViewPub, ephemeralPublicKey]);
      const sharedSecret = F.toString(sharedSecretHash);
      console.log('   Shared Secret:', sharedSecret);

      // Compute stealth address
      const stealthAddressHash = poseidon([sharedSecret, transferAmount, stealthSalt]);
      const computedStealthAddress = F.toString(stealthAddressHash);

      console.log('   Computed Stealth Address:', computedStealthAddress);
      console.log('   Expected Stealth Address:', expectedStealthAddress);
      console.log();

      if (computedStealthAddress === expectedStealthAddress) {
        console.log('✅✅✅ SUCCESS! Your keys are CORRECT!');
        console.log();
        console.log('Your decoded keys to use for claiming:');
        console.log('viewPrivateKey:', decodedView);
        console.log('spendPrivateKey:', decodedSpend);
      } else {
        console.log('❌ Keys decoded but stealth address doesn\'t match!');
        console.log('   This means the encoding/decoding needs adjustment.');
      }
    } else {
      console.log('   ❌ MISMATCH! Decoding method is incorrect.');
      console.log('   The decoded view private key doesn\'t match the stored public key.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nThe encoding format might be different than expected.');
    console.log('You may need to check the frontend code to see how keys are encoded/decoded.');
  }
}

verifyKeys().catch(console.error);
