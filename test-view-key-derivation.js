const { buildPoseidon } = require('circomlibjs');

/**
 * Test if the view private key correctly derives the stored view public key
 */
async function testViewKeyDerivation() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  console.log('🔍 Testing View Key Derivation\n');
  console.log('===================================\n');

  // From localStorage (decoded - but we don't have the decoded private key yet)
  const storedViewPublicKey = '12403249645028111319077074451544044941449478071570263768724153261704332862533';

  console.log('📝 From localStorage:');
  console.log('   Stored View Public Key:', storedViewPublicKey);
  console.log();

  console.log('⚠️  To test this, we need to decode the view private key from localStorage');
  console.log('   The encoded value is: XVdSU11fXEtFfVxLXF9eWBgGHQEUHXVUVVtdTVlKWwMYf1ZBXFoYdFNQFHxnGW8SCQhoBAdtBxATdkFHVVFhUlZ+WEwcBAIAHwIOGRo=');
  console.log();
  console.log('   This is XOR-obfuscated with (window.location.hostname + navigator.userAgent)');
  console.log('   We cannot decode it in Node.js without knowing those browser values.');
  console.log();
  console.log('📝 SOLUTION:');
  console.log('   Open your browser console and run:');
  console.log('   ```');
  console.log('   import("./utils/keyManagement.js").then(km => {');
  console.log('     const keys = km.loadKeys();');
  console.log('     console.log("viewPrivateKey:", keys.viewPrivateKey);');
  console.log('     console.log("spendPrivateKey:", keys.spendPrivateKey);');
  console.log('     console.log("viewPublicKey:", keys.viewPublicKey);');
  console.log('   });');
  console.log('   ```');
  console.log();
  console.log('   Then paste the decoded viewPrivateKey here to verify derivation.');
  console.log();

  // TEST: If you manually provide the viewPrivateKey, we can test
  const testViewPrivateKey = process.argv[2];

  if (testViewPrivateKey && testViewPrivateKey !== 'YOUR_VIEW_PRIVATE_KEY_HERE') {
    console.log('🧮 Testing with provided viewPrivateKey...');
    console.log('   Input viewPrivateKey:', testViewPrivateKey.substring(0, 20) + '...');

    const derivedViewPubHash = poseidon([testViewPrivateKey]);
    const derivedViewPublicKey = F.toString(derivedViewPubHash);

    console.log('   Derived View Public Key:', derivedViewPublicKey);
    console.log('   Stored View Public Key:', storedViewPublicKey);
    console.log();

    if (derivedViewPublicKey === storedViewPublicKey) {
      console.log('✅ MATCH! View key derivation is correct.');
      console.log('   The viewPrivateKey correctly derives the stored viewPublicKey.');
    } else {
      console.log('❌ MISMATCH! View key derivation is WRONG!');
      console.log('   The stored viewPrivateKey does NOT match the stored viewPublicKey!');
      console.log('   This would explain why the claim circuit computes the wrong stealth address.');
    }
  } else {
    console.log('💡 To test, run: node test-view-key-derivation.js YOUR_DECODED_VIEW_PRIVATE_KEY');
  }
}

testViewKeyDerivation().catch(console.error);
