// Test what root value fixed-merkle-tree returns for empty tree
const { MerkleTree } = require('fixed-merkle-tree');
const { buildPoseidon } = require('circomlibjs');

async function test() {
  const poseidon = await buildPoseidon();

  const poseidonHash = (elements) => {
    const inputs = Array.isArray(elements) ? elements : [elements];
    const hash = poseidon(inputs);
    return poseidon.F.toString(hash);
  };

  // Initialize empty Merkle tree (same as plonkProverPhase6.js line 83)
  const merkleTree = new MerkleTree(20, [], { hashFunction: poseidonHash });

  console.log('🌳 Empty Merkle Tree Test:');
  console.log('   Size:', merkleTree._layers[0].length);
  console.log('   Library Root (merkleTree.root):', merkleTree.root);
  console.log('   Layer 0:', merkleTree._layers[0]);
  console.log();
  console.log('   Root === "0"?', merkleTree.root === '0');
  console.log('   Root === 0?', merkleTree.root === 0);
  console.log();

  // Test custom logic from getMerkleRoot()
  if (merkleTree._layers[0].length === 0) {
    console.log('   Custom logic returns: "0"');
    console.log('   Contract expects: "0"');
  }
}

test().catch(console.error);
