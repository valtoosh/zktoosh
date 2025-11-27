const { buildPoseidon } = require('circomlibjs');

async function verifyActualPayment() {
  const poseidon = await buildPoseidon();
  
  // From the screenshot - ACTUAL on-chain values
  const stealthAddress = '12230842360805295821158466422';  // Truncated in screenshot
  const ephemeralPublicKey = '18361268334378026930496184125'; // Truncated in screenshot
  
  // The recipient view public key you're using
  const recipientViewPubKey = '12489885108646475413357093963440287537030633692172670593170505820620040731372';
  
  // Transfer parameters from screenshot
  const transferAmount = '1998';  // From the Asset ID field
  
  console.log('🔍 Verifying Payment from Screenshot\n');
  console.log('From screenshot:');
  console.log('  Stealth Address (truncated):', stealthAddress);
  console.log('  Ephemeral Key (truncated):', ephemeralPublicKey);
  console.log('  Transfer Amount:', transferAmount);
  console.log('');
  
  // The issue: we need the FULL stealth address and ephemeral key
  console.log('❌ PROBLEM: The screenshot shows TRUNCATED values!');
  console.log('   We need the FULL numbers to verify the computation.');
  console.log('');
  console.log('📋 To debug this, I need you to:');
  console.log('   1. Open browser console (F12)');
  console.log('   2. Look for the full stealth address value');
  console.log('   3. Look for the full ephemeral public key value');
  console.log('');
  console.log('Or check the backend logs for the transfer proof generation.');
}

verifyActualPayment().catch(console.error);
