// backend/src/services/plonkProverPhase6.js
const ethers = require('ethers');
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildPoseidon } = require('circomlibjs');
const { MerkleTree } = require('fixed-merkle-tree');

/**
 * Phase 6 PLONK Prover Service
 *
 * Integrates all Phase 6 features:
 * - Phase 6B: Stealth Addresses
 * - Phase 6C: Merkle Tree Anonymity Sets
 * - Phase 6D: Range Proofs
 * - Phase 6E: Encrypted Memos
 *
 * Public Signals (17 total):
 * [0] valid
 * [1] newBalance
 * [2] newBalanceCommitment
 * [3] recipientHash (backward compatible)
 * [4] nullifier
 * [5] sctNew (encrypted new ENA balance)
 * [6] stealthAddress (Phase 6B)
 * [7] ephemeralPublicKey (Phase 6B)
 * [8] merkleLeaf (Phase 6C)
 * [9] merkleProofValid (Phase 6C)
 * [10] encryptedMemoHash (Phase 6E)
 * [11] assetId
 * [12] maxAmount
 * [13] balanceCommitment
 * [14] sctOld
 * [15] vPubDelta
 * [16] merkleRoot (Phase 6C)
 */
class PlonkProverPhase6Service {
  constructor() {
    this.wasmPath = path.join(__dirname, '../../../circuits/plonk/build/transfer-phase6_js/transfer-phase6.wasm');
    this.zkeyPath = path.join(__dirname, '../../../circuits/plonk/build/transfer-phase6_final.zkey');
    this.vKeyPath = path.join(__dirname, '../../../circuits/plonk/build/verification_key.json');

    this.initialized = false;
    this.poseidon = null;
    this.stats = {
      totalProofs: 0,
      successfulProofs: 0,
      failedProofs: 0,
      avgTime: 0,
      totalTime: 0,
    };

    // Phase 6C: Initialize a persistent, in-memory Merkle tree
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
      this.poseidon = await buildPoseidon();

      // Define the hash function for the Merkle tree
      const poseidonHash = (elements) => {
        const inputs = Array.isArray(elements) ? elements : [elements];
        const hash = this.poseidon(inputs);
        return this.poseidon.F.toString(hash);
      };

      // Initialize the Merkle tree with a height of 20
      this.merkleTree = new MerkleTree(20, [], { hashFunction: poseidonHash });

      this.initialized = true;
      console.log('✅ PLONK Phase 6 Prover Service initialized');
      console.log(`   WASM: ${this.wasmPath}`);
      console.log(`   Proving Key: ${this.zkeyPath}`);
      console.log(`   Merkle Tree Initialized (Height: 20)`);
      console.log(`   Features: Stealth Addresses, Merkle Anonymity, Range Proofs, Encrypted Memos`);
    } catch (error) {
      console.error('❌ Failed to initialize Phase 6 Prover:', error.message);
      throw error;
    }
  }

  /**
   * Generate cryptographically secure random salt
   */
  generateSecureSalt() {
    const randomBytes = crypto.randomBytes(32);
    const randomBigInt = BigInt('0x' + randomBytes.toString('hex'));
    const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    return (randomBigInt % fieldModulus).toString();
  }

  /**
   * Generate ENA encryption key (kENA)
   */
  generateENAKey() {
    const randomBytes = crypto.randomBytes(32);
    const randomBigInt = BigInt('0x' + randomBytes.toString('hex'));
    const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    return (randomBigInt % fieldModulus).toString();
  }

  /**
   * Phase 6B: Generate ephemeral private key for stealth address
   */
  generateEphemeralKey() {
    const randomBytes = crypto.randomBytes(32);
    const randomBigInt = BigInt('0x' + randomBytes.toString('hex'));
    const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    return (randomBigInt % fieldModulus).toString();
  }

  /**
   * Phase 6B: Generate stealth address salt
   */
  generateStealthSalt() {
    return this.generateSecureSalt();
  }

  /**
   * Encrypt ENA balance using Poseidon
   */
  async encryptENABalance(balance, kENA) {
    if (!this.poseidon) {
      await this.initialize();
    }

    try {
      const hash = this.poseidon([BigInt(kENA), BigInt(balance)]);
      return this.poseidon.F.toString(hash);
    } catch (error) {
      console.error('❌ Failed to encrypt ENA balance:', error.message);
      throw error;
    }
  }

  /**
   * Phase 6E: Generate encrypted memo hash
   */
  async generateMemoHash(memo1, memo2) {
    if (!this.poseidon) {
      await this.initialize();
    }

    try {
      const hash = this.poseidon([BigInt(memo1 || 0), BigInt(memo2 || 0)]);
      return this.poseidon.F.toString(hash);
    } catch (error) {
      console.error('❌ Failed to generate memo hash:', error.message);
      throw error;
    }
  }

  async generateProof(input) {
    await this.initialize();

    console.log('\n🔵 Generating PLONK Phase 6 Proof (Stealth + Merkle + Range + Memo)...');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('Sender Balance (ENA):', input.senderBalance);
    console.log('Transfer Amount:', input.transferAmount);
    console.log('Recipient Address:', input.recipientAddress);
    console.log('Asset ID:', input.assetId);
    console.log('Max Amount:', input.maxAmount);
    console.log('vPubIn (EOA → ENA):', input.vPubIn || 0);
    console.log('vPubOut (ENA → EOA):', input.vPubOut || 0);
    console.log('═══════════════════════════════════════════════════════════════════');

    const startTime = Date.now();
    this.stats.totalProofs++;

    try {
      this.validateInput(input);

      const recipientViewPublicKey = input.recipientViewPublicKey || this.addressToHash(input.recipientAddress);

      const isFirstTransfer = !input.balanceCommitment ||
                              input.balanceCommitment === 'undefined' ||
                              input.balanceCommitment === 'null' ||
                              !input.salt ||
                              input.salt === 'undefined' ||
                              input.salt === 'null';

      let salt, kENA, balanceCommitment, sctOld, merkleRoot, merklePath;

      if (isFirstTransfer) {
        console.log('\n🆕 FIRST TRANSFER DETECTED - Initializing fresh cryptographic state');
        console.log('   Generating new salt and kENA...');
        salt = this.generateSecureSalt();
        kENA = this.generateENAKey();
        // Compute balanceCommitment = Poseidon(senderBalance, salt)
        const balanceCommitHash = this.poseidon([BigInt(input.senderBalance), BigInt(salt)]);
        balanceCommitment = this.poseidon.F.toString(balanceCommitHash);
        // Compute sctOld = Poseidon(kENA, senderBalance)
        sctOld = await this.encryptENABalance(input.senderBalance, kENA);
        console.log('   Computed balanceCommitment:', balanceCommitment.slice(0, 20) + '...');
        console.log('   Computed sctOld:', sctOld.slice(0, 20) + '...');

        // CRITICAL FIX: Use CURRENT on-chain Merkle root, not 0!
        // Even for first transfers (vPubIn > 0), the proof must include the current Merkle root
        // We don't prove our commitment exists (path = all zeros), but root must match on-chain
        merkleRoot = this.getMerkleRoot();
        merklePath = { pathElements: Array(20).fill('0'), pathIndices: Array(20).fill('0') };
        console.log('   Using current Merkle root:', merkleRoot.slice(0, 20) + '... (first transfer, empty path)');
      } else {
        console.log('\n🔄 SUBSEQUENT TRANSFER DETECTED - Using provided state');
        salt = input.salt;
        kENA = input.kENA;
        balanceCommitment = input.balanceCommitment;
        sctOld = input.sctOld;

        console.log('   Finding leaf for commitment:', balanceCommitment.slice(0, 20) + '...');
        const leafIndex = this.merkleTree.indexOf(balanceCommitment);
        if (leafIndex === -1) {
          throw new Error('The provided balance commitment does not exist in the Merkle tree. Your local state is out of sync with the backend.');
        }

        console.log(`   Leaf found at index: ${leafIndex}`);
        merklePath = this.merkleTree.path(leafIndex);
        merkleRoot = this.getMerkleRoot();
        console.log('   Generated Merkle proof for path, root:', merkleRoot.slice(0, 20) + '...');
      }

      const ephemeralPrivateKey = input.ephemeralPrivateKey || this.generateEphemeralKey();
      const stealthSalt = input.stealthSalt || this.generateStealthSalt();
      const vPubIn = input.vPubIn || 0;
      const vPubOut = input.vPubOut || 0;
      const vPubDelta = vPubIn - vPubOut;
      const encryptedMemo = input.encryptedMemo || ['0', '0'];

      console.log('\n🔐 Phase 6 Privacy Layers (Monero-Style):');
      console.log('   📍 Recipient View Public Key:', recipientViewPublicKey.slice(0, 20) + '...');
      console.log('   🔑 Salt:', salt.slice(0, 20) + '...');
      console.log('   🔒 kENA:', kENA.slice(0, 20) + '...');
      console.log('   📊 sctOld (encrypted):', sctOld);
      console.log('   💸 vPubDelta:', vPubDelta);
      console.log('   👻 Ephemeral Private Key:', ephemeralPrivateKey.slice(0, 20) + '...');
      console.log('   🎭 Stealth Salt:', stealthSalt.slice(0, 20) + '...');
      console.log('   🌳 Merkle Root:', merkleRoot);
      console.log('   📝 Encrypted Memo:', encryptedMemo);
      console.log('   💹 Balance Commitment:', balanceCommitment);

      // CRITICAL DEBUG: Log the actual merkleRoot value being passed
      console.log('   🔍 MERKLE ROOT DEBUG:');
      console.log('      getMerkleRoot() returned:', merkleRoot);
      console.log('      Type:', typeof merkleRoot);
      console.log('      Tree size:', this.merkleTree._layers[0].length);
      console.log('      Library .root property:', this.merkleTree.root);

      const circuitInput = {
        senderBalance: input.senderBalance,
        transferAmount: input.transferAmount,
        recipientViewPublicKey: recipientViewPublicKey,
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

      console.log('   🔍 CIRCUIT INPUT merkleRoot:', circuitInput.merkleRoot);

      console.log('\n⚙️  Generating Phase 6 proof (this may take ~700ms due to 20k constraints)...');

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

      // After successful proof, update the Merkle tree with the new commitment
      const newCommitment = publicSignals[8]; // merkleLeaf is at index 8
      this.merkleTree.insert(newCommitment);
      console.log('   🌳 Merkle tree updated with new leaf:', newCommitment.slice(0, 20) + '...');
      console.log('   New Merkle Root:', this.getMerkleRoot().slice(0, 20) + '...');


      console.log('═══════════════════════════════════════════════════════════════════');
      console.log('Public Signals (17 total - Phase 6 Unified):');
      console.log('  Outputs (0-10):');
      console.log('    [0] valid:', publicSignals[0]);
      console.log('    [1] newBalance:', publicSignals[1]);
      console.log('    [2] newBalanceCommitment:', publicSignals[2]);
      console.log('    [3] recipientHash (compat):', publicSignals[3]);
      console.log('    [4] nullifier:', publicSignals[4]);
      console.log('    [5] sctNew:', publicSignals[5]);
      console.log('    [6] stealthAddress (6B):', publicSignals[6]);
      console.log('    [7] ephemeralPublicKey (6B):', publicSignals[7]);
      console.log('    [8] merkleLeaf (6C):', publicSignals[8]);
      console.log('    [9] merkleProofValid (6C):', publicSignals[9]);
      console.log('    [10] encryptedMemoHash (6E):', publicSignals[10]);
      console.log('  Public Inputs (11-16):');
      console.log('    [11] assetId:', publicSignals[11]);
      console.log('    [12] maxAmount:', publicSignals[12]);
      console.log('    [13] balanceCommitment:', publicSignals[13]);
      console.log('    [14] sctOld:', publicSignals[14]);
      console.log('    [15] vPubDelta:', publicSignals[15]);
      console.log('    [16] merkleRoot:', publicSignals[16]);
      console.log('═══════════════════════════════════════════════════════════════════\n');

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
        stealthAddress: publicSignals[6], // Phase 6B
        ephemeralPublicKey: publicSignals[7], // Phase 6B
        merkleLeaf: publicSignals[8], // Phase 6C
        merkleProofValid: publicSignals[9], // Phase 6C
        encryptedMemoHash: publicSignals[10], // Phase 6E
        salt: salt,
        kENA: kENA,
        ephemeralPrivateKey: ephemeralPrivateKey, // Return for recipient
        stealthSalt: stealthSalt,
        vPubDelta: vPubDelta,
        recipientAddress: input.recipientAddress,
        stats: { ...this.stats }
      };
    } catch (error) {
      this.stats.failedProofs++;
      console.error('❌ Phase 6 proof generation failed:', error.message);
      throw new Error(`Phase 6 proof generation failed: ${error.message}`);
    }
  }

  addressToHash(address) {
    if (!address || typeof address !== 'string') {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`Invalid Ethereum address format: ${address}`);
    }

    const normalizedAddress = address.toLowerCase();
    const addressNumber = BigInt(normalizedAddress);

    return addressNumber.toString();
  }

  async calculateCommitment(balance, salt) {
    if (!this.poseidon) {
      await this.initialize();
    }

    try {
      const hash = this.poseidon([BigInt(balance), BigInt(salt)]);
      return this.poseidon.F.toString(hash);
    } catch (error) {
      console.error('❌ Failed to calculate Poseidon commitment:', error.message);
      throw error;
    }
  }

  async verifyProof(proof, publicSignals) {
    await this.initialize();

    try {
      console.log('🔍 Verifying Phase 6 PLONK proof off-chain...');
      const isValid = await snarkjs.plonk.verify(this.vKey, publicSignals, proof);

      console.log(`   Result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
      return isValid;
    } catch (error) {
      console.error('❌ Proof verification failed:', error.message);
      return false;
    }
  }

  formatProofForContract(proof, publicSignals) {
    return snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
  }

  validateInput(input) {
    // MONERO-STYLE: Accept either recipientViewPublicKey or recipientAddress
    const recipient = input.recipientViewPublicKey || input.recipientAddress;
    const required = ['senderBalance', 'transferAmount', 'assetId', 'maxAmount'];

    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Check that we have a recipient (either viewPublicKey or address)
    if (!recipient || typeof recipient !== 'string') {
      throw new Error('Missing recipientViewPublicKey or recipientAddress');
    }

    // MONERO-STYLE: If it's a view public key (large number), don't validate as Ethereum address
    // View public keys are field elements (up to 77 digits), not Ethereum addresses
    const isEthAddress = /^0x[0-9a-fA-F]{40}$/.test(recipient);
    const isViewPublicKey = /^\d+$/.test(recipient); // Large decimal number

    if (!isEthAddress && !isViewPublicKey) {
      throw new Error('Recipient must be either a valid Ethereum address (0x...) or a view public key (decimal number)');
    }

    if (typeof input.senderBalance !== 'number' || input.senderBalance < 0) {
      throw new Error('senderBalance must be a non-negative number');
    }

    if (typeof input.transferAmount !== 'number' || input.transferAmount < 0) {
      throw new Error('transferAmount must be a non-negative number');
    }

    if (typeof input.assetId !== 'number' || input.assetId <= 0) {
      throw new Error('assetId must be a positive number');
    }

    if (typeof input.maxAmount !== 'number' || input.maxAmount <= 0) {
      throw new Error('maxAmount must be a positive number');
    }

    const vPubIn = input.vPubIn || 0;
    const vPubOut = input.vPubOut || 0;

    if (input.transferAmount === 0 && vPubIn === 0 && vPubOut === 0) {
      throw new Error('Invalid transaction: transferAmount, vPubIn, and vPubOut cannot all be zero');
    }

    const totalDeduction = input.transferAmount + vPubOut;
    const newBalance = input.senderBalance + vPubIn - totalDeduction;

    if (newBalance < 0) {
      console.warn('⚠️  Transaction would result in negative balance (will be rejected by circuit)');
    }

    if (input.transferAmount > input.maxAmount) {
      console.warn('⚠️  Transfer amount exceeds max allowed (will be rejected by circuit)');
    }
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalProofs > 0
        ? ((this.stats.successfulProofs / this.stats.totalProofs) * 100).toFixed(2) + '%'
        : 'N/A',
      avgTimeFormatted: this.stats.avgTime.toFixed(2) + 'ms',
      merkleTreeSize: this.merkleTree._layers[0].length
    };
  }

  /**
   * Get Merkle root (match contract behavior exactly)
   */
  getMerkleRoot() {
    if (!this.merkleTree || this.merkleTree._layers[0].length === 0) {
      return '0'; // Contract returns 0 for empty tree (PrivateTransferV4.sol line 146)
    }
    if (this.merkleTree._layers[0].length === 1) {
      return this.merkleTree._layers[0][0]; // Contract returns leaf itself for size=1 (PrivateTransferV4.sol line 344)
    }
    return this.merkleTree.root;
  }

  getMerkleTreeState() {
    return this.merkleTree ? {
      root: this.getMerkleRoot(),
      size: this.merkleTree._layers[0].length,
    } : { root: '0', size: 0 };
  }

  resetStats() {
    this.stats = {
      totalProofs: 0,
      successfulProofs: 0,
      failedProofs: 0,
      avgTime: 0,
      totalTime: 0,
    };
  }
}

module.exports = new PlonkProverPhase6Service();
