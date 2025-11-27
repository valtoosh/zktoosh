const { buildPoseidon } = require('circomlibjs');

async function verifyCorrectKeys() {
  const poseidon = await buildPoseidon();
  
  // The view PRIVATE key you said you're using
  const viewPrivateKey = '12489885108646475413357093963440287537030633692172670593170505820620040731372';
  
  console.log('🔍 Using View Private Key:', viewPrivateKey);
  console.log('');
  
  // Compute the correct view PUBLIC key from this private key
  const viewPub = poseidon([BigInt(viewPrivateKey)]);
  const viewPubStr = poseidon.F.toString(viewPub);
  
  console.log('✅ Correct View PUBLIC Key:', viewPubStr);
  console.log('');
  
  // Now recompute the shared secret with the ephemeral key from the transfer
  const ephemeralPublicKey = '21483530048861213894941474738516751498255051990430074854803994765880699688829';
  
  console.log('Using Ephemeral Public Key:', ephemeralPublicKey);
  console.log('');
  
  // Compute shared secret: Poseidon(viewPub, ephemeralPub)
  const sharedSecret = poseidon([BigInt(viewPubStr), BigInt(ephemeralPublicKey)]);
  const sharedSecretStr = poseidon.F.toString(sharedSecret);
  
  console.log('Shared Secret:', sharedSecretStr);
  console.log('');
  
  // Compute stealth address
  const transferAmount = '1994';
  const stealthSalt = '8121419866815614975313296916809764198267617912854145062936823048858869751878';
  
  const stealthHash = poseidon([
    BigInt(sharedSecretStr),
    BigInt(transferAmount),
    BigInt(stealthSalt)
  ]);
  const stealthAddress = poseidon.F.toString(stealthHash);
  
  console.log('📍 Computed Stealth Address:', stealthAddress);
  console.log('');
  console.log('🎯 Stealth Address from claim attempt:', '12773354062467368850752478166019668586533070577669677896866772675399906639456');
  console.log('');
  console.log('✅ MATCH?', stealthAddress === '12773354062467368850752478166019668586533070577669677896866772675399906639456');
}

verifyCorrectKeys().catch(console.error);
