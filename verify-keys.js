const { buildPoseidon } = require('circomlibjs');

async function verifyKeys() {
  const poseidon = await buildPoseidon();
  
  // The view private key used in the claim
  const viewPrivateKey = '695700678411459715185621620016236443759870077052272035825772807444788810096';
  
  // The recipient public key you said you entered for the transfer
  const claimedRecipientPubKey = '12489885108646475413357093963440287537030633692172670593170505820620040731372';
  
  // Compute the CORRECT public key from the private key
  const correctViewPub = poseidon([BigInt(viewPrivateKey)]);
  const correctViewPubStr = poseidon.F.toString(correctViewPub);
  
  console.log('🔍 Key Verification:\n');
  console.log('View Private Key:', viewPrivateKey);
  console.log('\nWhat you SAID you entered as recipient:');
  console.log('  ', claimedRecipientPubKey);
  console.log('\nCORRECT public key for this private key:');
  console.log('  ', correctViewPubStr);
  console.log('\n✅ Keys MATCH?', claimedRecipientPubKey === correctViewPubStr);
  
  if (claimedRecipientPubKey !== correctViewPubStr) {
    console.log('\n❌ MISMATCH! You entered a DIFFERENT public key than expected!');
    console.log('   This means either:');
    console.log('   1. You entered a different recipient\'s public key');
    console.log('   2. The public key was generated incorrectly');
    console.log('   3. You\'re trying to claim with the WRONG view private key');
  }
}

verifyKeys().catch(console.error);
