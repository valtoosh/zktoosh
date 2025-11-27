const { buildPoseidon } = require('circomlibjs');

async function computeViewPub() {
  const poseidon = await buildPoseidon();
  
  // The view PRIVATE key you've been using
  const viewPrivateKey = '695700678411459715185621620016236443759870077052272035825772807444788810096';
  
  console.log('Computing CORRECT view public key:\n');
  console.log('View Private Key:', viewPrivateKey);
  
  // CORRECT formula: viewPub = Poseidon(viewPriv)
  const viewPub = poseidon([BigInt(viewPrivateKey)]);
  const viewPubStr = poseidon.F.toString(viewPub);
  
  console.log('View Public Key: ', viewPubStr);
  console.log('\n❌ You entered this as the recipient when making the transfer:');
  console.log('   ', viewPrivateKey);
  console.log('\n✅ You SHOULD have entered:');
  console.log('   ', viewPubStr);
  console.log('\n🔑 The transfer was sent to the WRONG public key!');
  console.log('   That\'s why claiming fails - the stealth address was computed');
  console.log('   using the private key value directly instead of its hash.');
}

computeViewPub().catch(console.error);
