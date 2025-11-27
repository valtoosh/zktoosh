// Test script to see snarkjs calldata format
const snarkjs = require('snarkjs');
const fs = require('fs');

// Read the proof from our test
const proofData = JSON.parse(fs.readFileSync('/tmp/zkult_proof.json', 'utf8'));

async function test() {
  console.log('Testing snarkjs.plonk.exportSolidityCallData...\n');

  const calldata = await snarkjs.plonk.exportSolidityCallData(
    proofData.proof,
    proofData.publicSignals
  );

  console.log('Type:', typeof calldata);
  console.log('Length:', calldata.length);
  console.log('\nFull output:\n', calldata);
  console.log('\n\nParsed as JSON:');

  try {
    const parsed = JSON.parse(calldata);
    console.log('Success! Type:', Array.isArray(parsed) ? 'Array' : typeof parsed);
    console.log('Length:', parsed.length);
    console.log('Last element type:', Array.isArray(parsed[parsed.length - 1]) ? 'Array' : typeof parsed[parsed.length - 1]);
  } catch (e) {
    console.log('Failed:', e.message);
  }
}

test();
