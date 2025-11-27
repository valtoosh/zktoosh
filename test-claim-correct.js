const snarkjs = require('snarkjs');

async function testClaimWithCorrectValues() {
  console.log('🧪 Testing claim circuit with CORRECT values from screenshots...\n');

  // Correct values from the screenshots
  const input = {
    // Private inputs (your keys)
    viewPrivateKey: '695700678411459715185621620016236443759870077052272035825772807444788810096',
    spendPrivateKey: '695700678411459715185621620016236443759870077052272035825772807444788810096',

    // Transfer details (from sender's confirmation)
    transferAmount: '5000',
    stealthSalt: '19715550748923087697853759883029674766361287842824051828080207698469748605190',
    ephemeralPublicKey: '6249269870590657320182903953538963991896215042849087145946780796261048334842',

    // Public inputs
    assetId: '1998',
    stealthAddress: '20323399430168737281104400779440323898281793107077081073212135123944556588380'
  };

  console.log('📝 Input values:');
  console.log('   Transfer Amount:', input.transferAmount);
  console.log('   Stealth Salt:', input.stealthSalt);
  console.log('   Asset ID:', input.assetId);
  console.log('   Stealth Address:', input.stealthAddress);

  const wasmPath = './circuits/plonk/claim_build/claim_js/claim.wasm';
  const zkeyPath = './circuits/plonk/claim_build/claim_final.zkey';

  console.log('\n⚙️  Generating witness...');

  try {
    const { proof, publicSignals } = await snarkjs.plonk.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log('\n✅ Proof generated successfully!');
    console.log('\n📊 Public Signals Output:');
    publicSignals.forEach((sig, i) => {
      console.log(`   [${i}]: ${sig}`);
    });

    console.log('\n🔍 Analysis:');
    console.log(`   valid (signal[0]): ${publicSignals[0]} ${publicSignals[0] === '1' ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`   claimerAddressHash (signal[1]): ${publicSignals[1]}`);
    console.log(`   claimedAmount (signal[2]): ${publicSignals[2]} ${publicSignals[2] === input.transferAmount ? '✅' : '❌'}`);
    console.log(`   assetId (signal[3]): ${publicSignals[3]} ${publicSignals[3] === input.assetId ? '✅' : '❌'}`);
    console.log(`   stealthAddress (signal[4]): ${publicSignals[4]} ${publicSignals[4] === input.stealthAddress ? '✅' : '❌'}`);

    if (publicSignals[0] === '1') {
      console.log('\n🎉 SUCCESS! The circuit validated the claim. The proof should work on-chain!');
    } else {
      console.log('\n❌ FAILURE! The stealth address verification failed. Check your input values.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testClaimWithCorrectValues();
