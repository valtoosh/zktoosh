const { buildPoseidon } = require('circomlibjs');

async function debugSharedSecret() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('DEBUG: Shared Secret and Stealth Address Computation');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // KNOWN VALUES from user
  const recipientViewPublicKey = '12489885108646475413357093963440287537030633369217267059317050582062004073137';
  const transferAmount = '5000';
  const stealthSalt = '13266819464709419563668515857770732571615550724548924968662410511410684650082';

  // ON-CHAIN VALUES (from transfer)
  const onChainStealthAddress = '16165269603063541273394149293448801778514853094379602141704876082089943325533';

  console.log('📝 Known Inputs:');
  console.log('   Recipient View Public Key:', recipientViewPublicKey);
  console.log('   Transfer Amount:', transferAmount);
  console.log('   Stealth Salt:', stealthSalt);
  console.log('   On-Chain Stealth Address:', onChainStealthAddress);
  console.log('');

  console.log('───────────────────────────────────────────────────────────────────');
  console.log('STEP 1: Query on-chain payment to get ephemeral public key');
  console.log('───────────────────────────────────────────────────────────────────\n');

  const { ethers } = require('ethers');
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/dbde77edfe80476f96a9db02e3eb8a83');

  // Try to get the actual contract address from config
  const contractAddress = '0x57901a99c38a9Dd65dAaa5761Cb57D1f7296be24'; // Latest deployment

  const abi = [
    'function stealthPayments(uint256) view returns (uint256 stealthAddress, uint256 ephemeralPublicKey, uint256 encryptedAmount, uint256 timestamp, bytes32 encryptedMemo, bool claimed)',
    'event StealthPaymentCreated(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp)'
  ];

  const contract = new ethers.Contract(contractAddress, abi, provider);

  try {
    // First try to get from stealthPayments mapping
    console.log('   Querying stealthPayments(' + onChainStealthAddress + ')...');
    const payment = await contract.stealthPayments(onChainStealthAddress);

    let ephemeralPublicKey;

    if (payment.stealthAddress.toString() === '0') {
      console.log('   ❌ Mapping returns zero, searching for event...\n');

      // Search for StealthPaymentCreated event
      const filter = contract.filters.StealthPaymentCreated(onChainStealthAddress);
      const events = await contract.queryFilter(filter, 0, 'latest');

      if (events.length > 0) {
        ephemeralPublicKey = events[0].args.ephemeralPublicKey.toString();
        console.log('   ✅ Found ephemeral public key from event:', ephemeralPublicKey);
      } else {
        console.log('   ❌ No event found! Trying ALL events...\n');

        const allFilter = contract.filters.StealthPaymentCreated();
        const allEvents = await contract.queryFilter(allFilter, 0, 'latest');

        console.log('   Found', allEvents.length, 'total StealthPaymentCreated events');

        if (allEvents.length > 0) {
          // Use the most recent one
          const latestEvent = allEvents[allEvents.length - 1];
          ephemeralPublicKey = latestEvent.args.ephemeralPublicKey.toString();
          const eventStealthAddr = latestEvent.args.stealthAddress.toString();

          console.log('   Latest event stealth address:', eventStealthAddr);
          console.log('   Latest event ephemeral key:', ephemeralPublicKey);

          if (eventStealthAddr !== onChainStealthAddress) {
            console.log('   ⚠️  WARNING: Event stealth address does NOT match on-chain address!');
            console.log('   This confirms the stealth address mismatch bug.');
          }
        } else {
          console.log('   ❌ No events found at all!');
          process.exit(1);
        }
      }
    } else {
      ephemeralPublicKey = payment.ephemeralPublicKey.toString();
      console.log('   ✅ Ephemeral Public Key:', ephemeralPublicKey);
    }

    console.log('');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log('STEP 2: Compute shared secret (TRANSFER SIDE)');
    console.log('───────────────────────────────────────────────────────────────────\n');

    console.log('   Formula: sharedSecret = Poseidon(recipientViewPublicKey, ephemeralPublicKey)');
    console.log('');

    const sharedSecret = poseidon([BigInt(recipientViewPublicKey), BigInt(ephemeralPublicKey)]);
    const sharedSecretStr = F.toString(sharedSecret);

    console.log('   Input[0] (recipientViewPublicKey):', recipientViewPublicKey);
    console.log('   Input[1] (ephemeralPublicKey):', ephemeralPublicKey);
    console.log('   Output (sharedSecret):', sharedSecretStr);
    console.log('');

    console.log('───────────────────────────────────────────────────────────────────');
    console.log('STEP 3: Compute stealth address (TRANSFER SIDE)');
    console.log('───────────────────────────────────────────────────────────────────\n');

    console.log('   Formula: stealthAddress = Poseidon(sharedSecret, transferAmount, stealthSalt)');
    console.log('');

    const computedStealthAddress = poseidon([
      BigInt(sharedSecretStr),
      BigInt(transferAmount),
      BigInt(stealthSalt)
    ]);
    const computedStealthAddressStr = F.toString(computedStealthAddress);

    console.log('   Input[0] (sharedSecret):', sharedSecretStr);
    console.log('   Input[1] (transferAmount):', transferAmount);
    console.log('   Input[2] (stealthSalt):', stealthSalt);
    console.log('   Output (stealthAddress):', computedStealthAddressStr);
    console.log('');

    console.log('───────────────────────────────────────────────────────────────────');
    console.log('STEP 4: Compare with on-chain stealth address');
    console.log('───────────────────────────────────────────────────────────────────\n');

    console.log('   Computed Stealth Address:', computedStealthAddressStr);
    console.log('   On-Chain Stealth Address:', onChainStealthAddress);
    console.log('');

    if (computedStealthAddressStr === onChainStealthAddress) {
      console.log('   ✅ MATCH! Stealth addresses are identical.');
      console.log('   The transfer circuit computed the stealth address correctly.');
    } else {
      console.log('   ❌ MISMATCH! Stealth addresses are different.');
      console.log('');
      console.log('   This means ONE of the following:');
      console.log('   1. recipientViewPublicKey used in transfer was different');
      console.log('   2. ephemeralPublicKey derivation is different');
      console.log('   3. transferAmount or stealthSalt were different');
      console.log('');
      console.log('   We need to check the ACTUAL values used in the transfer proof!');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('NEXT STEPS');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('To identify the exact mismatch, we need to:');
    console.log('1. Check backend transfer logs for actual recipientViewPublicKey used');
    console.log('2. Check if ephemeralPublicKey was computed correctly from ephemeralPrivateKey');
    console.log('3. Verify transferAmount and stealthSalt match what was passed to circuit');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

debugSharedSecret().catch(console.error);
