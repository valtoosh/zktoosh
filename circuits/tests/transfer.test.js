// circuits/tests/transfer.test.js
const path = require('path');
const wasm_tester = require('circom_tester').wasm;
const buildPoseidon = require('circomlibjs').buildPoseidon;

describe('PLONK Transfer Circuit Tests', function() {
  let circuit;
  
  this.timeout(100000); // Compilation can be slow

  before(async () => {
    // Compile circuit
    circuit = await wasm_tester(
      path.join(__dirname, '../plonk/transfer.circom'),
      {
        output: path.join(__dirname, '../../backend/keys/plonk/test'),
        recompile: true
      }
    );
  });

  it('Should validate a correct transfer', async () => {
    const input = {
      senderBalance: 6000,
      transferAmount: 95,
      assetId: 1998,
      recipientId: 123456789,
      maxAmount: 12000
    };

    const witness = await circuit.calculateWitness(input);
    await circuit.checkConstraints(witness);
    
    // Check outputs
    const valid = witness[1]; // First output
    const newBalance = witness[2]; // Second output
    
    console.log('Valid:', valid);
    console.log('New Balance:', newBalance);
    
    // Assertions
    if (valid !== 1n) {
      throw new Error('Transfer should be valid');
    }
    
    if (newBalance !== 5905n) {
      throw new Error(`New balance should be 5905, got ${newBalance}`);
    }
  });

  it('Should reject overdraft', async () => {
    const input = {
      senderBalance: 1000,
      transferAmount: 2000, // More than balance!
      assetId: 1998,
      recipientId: 123456789,
      maxAmount: 12000
    };

    const witness = await circuit.calculateWitness(input);
    await circuit.checkConstraints(witness);
    
    const valid = witness[1];
    
    if (valid !== 0n) {
      throw new Error('Overdraft should be rejected');
    }
  });

  it('Should reject amount > maxAmount', async () => {
    const input = {
      senderBalance: 10000,
      transferAmount: 15000, // More than max!
      assetId: 1998,
      recipientId: 123456789,
      maxAmount: 12000
    };

    const witness = await circuit.calculateWitness(input);
    await circuit.checkConstraints(witness);
    
    const valid = witness[1];
    
    if (valid !== 0n) {
      throw new Error('Amount exceeding max should be rejected');
    }
  });

  it('Should reject zero transfer', async () => {
    const input = {
      senderBalance: 5000,
      transferAmount: 0, // Zero amount!
      assetId: 1998,
      recipientId: 123456789,
      maxAmount: 12000
    };

    const witness = await circuit.calculateWitness(input);
    await circuit.checkConstraints(witness);
    
    const valid = witness[1];
    
    if (valid !== 0n) {
      throw new Error('Zero transfer should be rejected');
    }
  });

  it('Should reject invalid asset', async () => {
    const input = {
      senderBalance: 5000,
      transferAmount: 100,
      assetId: 0, // Invalid asset!
      recipientId: 123456789,
      maxAmount: 12000
    };

    const witness = await circuit.calculateWitness(input);
    await circuit.checkConstraints(witness);
    
    const valid = witness[1];
    
    if (valid !== 0n) {
      throw new Error('Invalid asset should be rejected');
    }
  });

  it('Should handle maximum values', async () => {
    const input = {
      senderBalance: 1000000,
      transferAmount: 999999,
      assetId: 2000,
      recipientId: 999999999,
      maxAmount: 1000000
    };

    const witness = await circuit.calculateWitness(input);
    await circuit.checkConstraints(witness);
    
    const valid = witness[1];
    const newBalance = witness[2];
    
    if (valid !== 1n) {
      throw new Error('Large transfer should be valid');
    }
    
    if (newBalance !== 1n) {
      throw new Error(`New balance should be 1, got ${newBalance}`);
    }
  });
});

describe('PLONK Enhanced Transfer Circuit Tests', function() {
  let circuit;
  let poseidon;
  
  this.timeout(100000);

  before(async () => {
    circuit = await wasm_tester(
      path.join(__dirname, '../plonk/transfer_enhanced.circom'),
      {
        output: path.join(__dirname, '../../backend/keys/plonk/test'),
        recompile: true
      }
    );
    
    poseidon = await buildPoseidon();
  });

  it('Should validate with correct commitment', async () => {
    const senderBalance = 6000;
    const salt = 12345;
    
    // Calculate commitment
    const F = poseidon.F;
    const commitment = poseidon([senderBalance, salt]);
    const commitmentDec = F.toObject(commitment);
    
    const input = {
      senderBalance: 6000,
      transferAmount: 95,
      recipientId: 123456789,
      salt: 12345,
      assetId: 1998,
      maxAmount: 12000,
      balanceCommitment: commitmentDec.toString()
    };

    const witness = await circuit.calculateWitness(input);
    await circuit.checkConstraints(witness);
    
    const valid = witness[1];
    
    if (valid !== 1n) {
      throw new Error('Transfer with commitment should be valid');
    }
  });

  it('Should reject incorrect commitment', async () => {
    const input = {
      senderBalance: 6000,
      transferAmount: 95,
      recipientId: 123456789,
      salt: 12345,
      assetId: 1998,
      maxAmount: 12000,
      balanceCommitment: '99999999999' // Wrong commitment!
    };

    try {
      await circuit.calculateWitness(input);
      throw new Error('Should have failed with wrong commitment');
    } catch (error) {
      if (!error.message.includes('Error: Assert Failed')) {
        throw error;
      }
      // Expected error - commitment mismatch
    }
  });
});