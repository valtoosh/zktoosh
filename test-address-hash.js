const { buildPoseidon } = require('circomlibjs');

async function testAddressHash() {
  const poseidon = await buildPoseidon();

  // The recipient Ethereum address from screenshot
  const recipientAddress = '0x195EfF9Bdb9b0EeD8D0feDE8fd9Bf6bff0352dC5';

  // Hash it the same way the backend does (addressToHash)
  const addressBigInt = BigInt(recipientAddress);
  const recipientViewPubFromAddress = poseidon.F.toString(poseidon([addressBigInt]));

  console.log('Testing if Ethereum address was used as recipientViewPublicKey:\n');
  console.log('Recipient Address:', recipientAddress);
  console.log('Hashed as recipientViewPub:', recipientViewPubFromAddress);
  console.log();

  // Now test if THIS produces the correct stealth address
  const ephemeralPrivateKey = BigInt('12345'); // We don't know this, but let's assume a test value
  const transferAmount = BigInt('5000');
  const stealthSalt = BigInt('19715550748923087697853759883029674766361287842824051828080207698469748605190');

  // Compute as transfer circuit would:
  // sharedSecret = Poseidon(ephemeralPriv, recipientViewPub)
  const sharedSecret = poseidon.F.toString(poseidon([ephemeralPrivateKey, BigInt(recipientViewPubFromAddress)]));
  const stealthComputed = poseidon.F.toString(poseidon([BigInt(sharedSecret), transferAmount, stealthSalt]));

  console.log('If ephemeralPriv was 12345 (example):');
  console.log('   Computed stealth:', stealthComputed);
  console.log('   Expected stealth:', '20323399430168737281104400779440323898281793107077081073212135123944556588380');
  console.log();

  // The real issue: For claiming to work with address-based recipient,
  // the claimer would need to know the ephemeralPrivateKey, which they don't have!
  console.log('❌ THE PROBLEM:');
  console.log('If you entered an Ethereum address as recipient during transfer,');
  console.log('the system hashed it to create recipientViewPub.');
  console.log('But claiming requires the viewPrivateKey that produces this viewPub.');
  console.log('Since you entered an ADDRESS (not a viewPublicKey), there is NO');
  console.log('corresponding viewPrivateKey that would work!');
  console.log();
  console.log('✅ THE SOLUTION:');
  console.log('You must enter the recipient\\'s VIEW PUBLIC KEY (not Ethereum address)');
  console.log('when making a transfer. The viewPublicKey = Poseidon(viewPrivateKey).');
}

testAddressHash();
