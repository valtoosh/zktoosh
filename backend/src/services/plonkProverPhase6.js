// backend/src/services/plonkProverPhase6.js
const ethers = require('ethers');
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildPoseidon, buildBabyjub, buildEddsa } = require('circomlibjs'); // ECDH dependencies
const { MerkleTree } = require('fixed-merkle-tree');

/**
 * Phase 6 PLONK Prover Service
 *
 * Integrates all Phase 6 features with BabyJubJub ECDH:
 * - Phase 6B: Stealth Addresses (ECDH Fixed)
 * - Phase 6C: Merkle Tree Anonymity Sets
 * - Phase 6D: Range Proofs
 * - Phase 6E: Encrypted Memos
 *
 * Public Signals (18 total):
 * [0] valid
 * [1] newBalance
 * [2] newBalanceCommitment
 * [3] recipientHash
 * [4] nullifier
 * [5] sctNew
 * [6] stealthAddress
 * [7] ephemeralPublicKey[0] (X)
 * [8] ephemeralPublicKey[1] (Y)
 * [9] merkleLeaf
 * [10] merkleProofValid
 * [11] encryptedMemoHash
 * ...
 */
class PlonkProverPhase6Service {
  constructor() {
    this.wasmPath = path.join(__dirname, '../../../circuits/plonk/build/transfer-phase6_js/transfer-phase6.wasm');
    this.zkeyPath = path.join(__dirname, '../../../circuits/plonk/build/transfer-phase6_final.zkey');
    this.vKeyPath = path.join(__dirname, '../../../circuits/plonk/build/verification_key.json');

    this.initialized = false;
    this.poseidon = null;
    this.babyJub = null;
    this.eddsa = null;
    this.F = null;

    this.stats = {
      totalProofs: 0,
      successfulProofs: 0,
      failedProofs: 0,
      avgTime: 0,
      totalTime: 0,
    };

    this.merkleTree = null;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(this.wasmPath)) {
        throw new Error(`WASM file not found at ${this.wasmPath}`);
      }
      if (!fs.existsSync(this.zkeyPath)) {
        throw new Error(`Proving key not found at ${this.zkeyPath}`);
      }
      if (!fs.existsSync(this.vKeyPath)) {
        throw new Error(`Verification key not found at ${this.vKeyPath}`);
      }

      this.vKey = JSON.parse(fs.readFileSync(this.vKeyPath, 'utf8'));
      
      // Initialize Crypto Primitives
      this.poseidon = await buildPoseidon();
      this.babyJub = await buildBabyjub();
      this.eddsa = await buildEddsa();
      this.F = this.poseidon.F;

      // Define hash function for Merkle Tree
      const poseidonHash = (elements) => {
        const inputs = Array.isArray(elements) ? elements : [elements];
        const hash = this.poseidon(inputs);
        return this.F.toString(hash);
      };

      this.merkleTree = new MerkleTree(20, [], { hashFunction: poseidonHash });

      this.initialized = true;
      console.log('✅ PLONK Phase 6 Prover Service initialized');
      console.log(`   Crypto: BabyJubJub + Poseidon initialized`);
    } catch (error) {
      console.error('❌ Failed to initialize Phase 6 Prover:', error.message);
      throw error;
    }
  }

  generateSecureSalt() {
    const randomBytes = crypto.randomBytes(32);
    const randomBigInt = BigInt('0x' + randomBytes.toString('hex'));
    const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    return (randomBigInt % fieldModulus).toString();
  }

  generateENAKey() {
    return this.generateSecureSalt();
  }

  /**
   * Phase 6B: Generate ephemeral private key (Scalar)
   * Must be a valid scalar for BabyJubJub multiplication
   */
  generateEphemeralKey() {
    return this.generateSecureSalt(); // Random scalar in field
  }

  generateStealthSalt() {
    return this.generateSecureSalt();
  }

  async encryptENABalance(balance, kENA) {
    if (!this.initialized) await this.initialize();
    try {
      const hash = this.poseidon([BigInt(kENA), BigInt(balance)]);
      return this.F.toString(hash);
    } catch (error) {
      throw error;
    }
  }

  async generateMemoHash(memo1, memo2) {
    if (!this.initialized) await this.initialize();
    try {
      const hash = this.poseidon([BigInt(memo1 || 0), BigInt(memo2 || 0)]);
      return this.F.toString(hash);
    } catch (error) {
      throw error;
    }
  }

  async generateProof(input) {
    await this.initialize();

    console.log('\n🔵 Generating PLONK Phase 6 Proof (ECDH Enabled)...');
    
    const startTime = Date.now();
    this.stats.totalProofs++;

    try {
      this.validateInput(input);

      // Handle Recipient Key: Must be [x, y] OR a view private key (scalar)
      let recipientViewPublicKey = input.recipientViewPublicKey;
      if (!recipientViewPublicKey && input.recipientAddress) {
         // In ECDH mode, we can't derive key from address unless address IS the key
         throw new Error("ECDH requires explicit recipientViewPublicKey [x, y] or view private key");
      }

      // Handle three formats:
      // 1. Array [x, y] - use as-is (view public key point)
      // 2. Single scalar - derive public key point from private key
      if (Array.isArray(recipientViewPublicKey)) {
          recipientViewPublicKey = recipientViewPublicKey.map(k => k.toString());
      } else if (recipientViewPublicKey) {
          // Treat as view private key and derive public key point
          console.log('🔧 Input appears to be view PRIVATE key, deriving public key point...');
          const viewPrivKey = BigInt(recipientViewPublicKey);

          // Derive public key: viewPubKey = viewPrivKey * G (base point)
          const G = this.babyJub.Base8; // [Gx, Gy]
          const viewPubKeyPoint = this.babyJub.mulPointEscalar(G, viewPrivKey);

          recipientViewPublicKey = [
              this.F.toString(viewPubKeyPoint[0]),
              this.F.toString(viewPubKeyPoint[1])
          ];

          console.log('✅ Derived view public key:');
          console.log('   X:', recipientViewPublicKey[0]);
          console.log('   Y:', recipientViewPublicKey[1]);
      } else {
          throw new Error("recipientViewPublicKey must be [x, y] array or view private key (scalar)");
      }

      const isFirstTransfer = !input.balanceCommitment || input.balanceCommitment === 'undefined';

      let salt, kENA, balanceCommitment, sctOld, merkleRoot, merklePath;

      if (isFirstTransfer) {
        console.log('\n🆕 FIRST TRANSFER DETECTED');
        salt = this.generateSecureSalt();
        kENA = this.generateENAKey();
        const balanceCommitHash = this.poseidon([BigInt(input.senderBalance), BigInt(salt)]);
        balanceCommitment = this.F.toString(balanceCommitHash);
        sctOld = await this.encryptENABalance(input.senderBalance, kENA);
        
        merkleRoot = this.getMerkleRoot();
        merklePath = { pathElements: Array(20).fill('0'), pathIndices: Array(20).fill('0') };
      } else {
        console.log('\n🔄 SUBSEQUENT TRANSFER DETECTED');
        salt = input.salt;
        kENA = input.kENA;
        balanceCommitment = input.balanceCommitment;
        sctOld = input.sctOld;

        const leafIndex = this.merkleTree.indexOf(balanceCommitment);
        if (leafIndex === -1) throw new Error('Commitment not in Merkle tree');
        
        merklePath = this.merkleTree.path(leafIndex);
        merkleRoot = this.getMerkleRoot();
      }

      const ephemeralPrivateKey = input.ephemeralPrivateKey || this.generateEphemeralKey();
      const stealthSalt = input.stealthSalt || this.generateStealthSalt();
      const vPubIn = input.vPubIn || 0;
      const vPubOut = input.vPubOut || 0;
      const vPubDelta = vPubIn - vPubOut;
      const encryptedMemo = input.encryptedMemo || ['0', '0'];

      // Log ECDH parameters
      console.log('   🔑 Ephemeral Private Key:', ephemeralPrivateKey.slice(0, 10) + '...');
      console.log('   🧂 Stealth Salt:', stealthSalt);
      console.log('   💰 Transfer Amount:', input.transferAmount);
      console.log('   📍 Recipient PubKey:', recipientViewPublicKey);

      const circuitInput = {
        senderBalance: input.senderBalance,
        transferAmount: input.transferAmount,
        recipientViewPublicKey: recipientViewPublicKey, // Now [x, y]
        salt: salt,
        kENA: kENA,
        vPubIn: vPubIn,
        vPubOut: vPubOut,
        ephemeralPrivateKey: ephemeralPrivateKey,
        stealthSalt: stealthSalt,
        merklePathElements: merklePath.pathElements,
        merklePathIndices: merklePath.pathIndices,
        encryptedMemo: encryptedMemo,
        assetId: input.assetId,
        maxAmount: input.maxAmount,
        balanceCommitment: balanceCommitment,
        sctOld: sctOld,
        vPubDelta: vPubDelta,
        merkleRoot: merkleRoot
      };

      console.log('\n⚙️  Generating Proof...');

      const { proof, publicSignals } = await snarkjs.plonk.fullProve(
        circuitInput,
        this.wasmPath,
        this.zkeyPath
      );

      const duration = Date.now() - startTime;
      this.stats.successfulProofs++;
      this.stats.totalTime += duration;
      this.stats.avgTime = this.stats.totalTime / this.stats.successfulProofs;

      console.log(`\n✅ Phase 6 PLONK proof generated in ${duration}ms`);
      
      // DEBUG: Log ALL signals to verify ordering
      console.log('🔍 PUBLIC SIGNALS DUMP:');
      publicSignals.forEach((sig, i) => console.log(`   [${i}]: ${sig}`));

      console.log('\n📤 OUTPUT VALUES (verify these match frontend UI):');
      console.log('   🎯 Stealth Address:', publicSignals[6]);
      console.log('   🔑 Ephemeral Public Key:');
      console.log('      X:', publicSignals[7]);
      console.log('      Y:', publicSignals[8]);

      // Update Merkle Tree
      // Indices shifted due to extra public key signal
      // [7] = Ephemeral X, [8] = Ephemeral Y
      // [9] = Merkle Leaf
      const newCommitment = publicSignals[9]; 
      this.merkleTree.insert(newCommitment);

      // Parse Ephemeral Public Key Point
      const ephemeralPublicKey = [publicSignals[7], publicSignals[8]];

      return {
        proof,
        publicSignals,
        proofSystem: 'plonk-phase6',
        generationTime: duration,
        valid: publicSignals[0] === '1',
        newBalance: publicSignals[1],
        newBalanceCommitment: publicSignals[2],
        recipientHash: publicSignals[3],
        nullifier: publicSignals[4],
        sctNew: publicSignals[5],
        stealthAddress: publicSignals[6],
        ephemeralPublicKey: ephemeralPublicKey, // Now [X, Y]
        merkleLeaf: publicSignals[9],
        merkleProofValid: publicSignals[10],
        encryptedMemoHash: publicSignals[11],
        
        // Private return values
        salt, kENA, ephemeralPrivateKey, stealthSalt, vPubDelta,
        stats: { ...this.stats }
      };
    } catch (error) {
      this.stats.failedProofs++;
      console.error('❌ Proof generation failed:', error.message);
      throw new Error(`Proof generation failed: ${error.message}`);
    }
  }

  async verifyProof(proof, publicSignals) {
    await this.initialize();
    try {
      return await snarkjs.plonk.verify(this.vKey, publicSignals, proof);
    } catch (error) {
      return false;
    }
  }

  async formatProofForContract(proof, publicSignals) {
    return await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
  }

  validateInput(input) {
    const required = ['senderBalance', 'transferAmount', 'assetId', 'maxAmount'];
    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validating [x, y] key (ECDH format)
    if (input.recipientViewPublicKey) {
        const key = input.recipientViewPublicKey;
        console.log(`🔍 Validating recipientViewPublicKey. Type: ${typeof key}, isArray: ${Array.isArray(key)}`);

        if (!Array.isArray(key) || key.length !== 2) {
            throw new Error(`recipientViewPublicKey must be [x, y] array. Got type: ${typeof key}, isArray: ${Array.isArray(key)}`);
        }

        // Normalize elements to strings
        input.recipientViewPublicKey = key.map(k => k.toString());
        console.log('✅ Validated ECDH public key [x, y]');
    }
  }

  getMerkleRoot() {
    if (!this.merkleTree || this.merkleTree._layers[0].length === 0) return '0';
    return this.merkleTree.root;
  }

  getMerkleTreeState() {
    return this.merkleTree ? {
      root: this.getMerkleRoot(),
      size: this.merkleTree._layers[0].length,
    } : { root: '0', size: 0 };
  }
}

module.exports = new PlonkProverPhase6Service();