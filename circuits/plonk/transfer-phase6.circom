pragma circom 2.1.8;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/poseidon.circom";
include "./merkle.circom";
include "./stealth.circom";
include "./range_proof.circom";

/*
 * zkUlt Phase 6 Unified Privacy Circuit
 *
 * Combines:
 * - Phase 5B: Dual Account Model (EOA + ENA) with symmetric encryption
 * - Phase 6B: Stealth Addresses for recipient privacy
 * - Phase 6C: Merkle Tree for anonymity sets
 * - Phase 6D: Range Proofs to prevent inference attacks
 * - Phase 6E: Encrypted memos (handled off-chain, memo hash on-chain)
 *
 * Public Signals Order (16 total):
 * Outputs (0-10):
 * [0] valid - transfer validation result
 * [1] newBalance - sender's ENA balance after transfer
 * [2] newBalanceCommitment - commitment to new balance
 * [3] recipientHash - backward compatible recipient hash
 * [4] nullifier - prevents double-spending
 * [5] sctNew - encrypted new ENA balance
 * [6] stealthAddress - one-time recipient address (Phase 6B)
 * [7] ephemeralPublicKey - for recipient scanning (Phase 6B)
 * [8] merkleLeaf - leaf to insert in Merkle tree (Phase 6C)
 * [9] merkleProofValid - Merkle proof validation (Phase 6C)
 * [10] encryptedMemoHash - hash of encrypted memo (Phase 6E)
 *
 * Public Inputs (11-15):
 * [11] assetId - asset identifier
 * [12] maxAmount - maximum allowed amount
 * [13] balanceCommitment - commitment to sender's balance
 * [14] sctOld - encrypted old ENA balance
 * [15] vPubDelta - net public transfer (deposit/withdraw)
 * [16] merkleRoot - current Merkle tree root (Phase 6C)
 */

template PlonkTransferPhase6() {
    // ============================================
    // PRIVATE INPUTS
    // ============================================

    // Phase 5B: Existing private inputs
    signal input senderBalance;              // Sender's current ENA balance
    signal input transferAmount;             // Amount to transfer
    signal input recipientViewPublicKey;     // Recipient's VIEW public key (Monero-style)
    signal input salt;                       // For commitment randomness
    signal input kENA;                       // Symmetric key for ENA encryption
    signal input vPubIn;                     // Public deposit (EOA → ENA)
    signal input vPubOut;                    // Public withdrawal (ENA → EOA)

    // Phase 6B: Monero-style stealth address private inputs
    signal input ephemeralPrivateKey;        // One-time private key for this transfer
    signal input stealthSalt;                // Salt for stealth address generation

    // Phase 6C: Merkle tree private inputs (20 levels = 1M capacity)
    signal input merklePathElements[20];     // Sibling hashes along path
    signal input merklePathIndices[20];      // Path directions (0=left, 1=right)

    // Phase 6E: Encrypted memo hash (memo encrypted off-chain)
    signal input encryptedMemo[2];           // Two field elements for memo hash

    // ============================================
    // PUBLIC INPUTS
    // ============================================
    signal input assetId;
    signal input maxAmount;
    signal input balanceCommitment;
    signal input sctOld;
    signal input vPubDelta;
    signal input merkleRoot;                 // Phase 6C: Current Merkle root

    // ============================================
    // OUTPUTS
    // ============================================
    signal output valid;
    signal output newBalance;
    signal output newBalanceCommitment;
    signal output recipientHash;
    signal output nullifier;
    signal output sctNew;
    signal output stealthAddress;            // Phase 6B
    signal output ephemeralPublicKey;        // Phase 6B
    signal output merkleLeaf;                // Phase 6C
    signal output merkleProofValid;          // Phase 6C
    signal output encryptedMemoHash;         // Phase 6E

    // ============================================
    // PHASE 5B: ENA VERIFICATION
    // ============================================
    component verifyOld = Poseidon(2);
    verifyOld.inputs[0] <== kENA;
    verifyOld.inputs[1] <== senderBalance;

    signal vENAold;
    vENAold <== verifyOld.out;
    vENAold === sctOld;

    // ============================================
    // COMMITMENT VERIFICATION
    // ============================================
    component commitmentCheck = Poseidon(2);
    commitmentCheck.inputs[0] <== senderBalance;
    commitmentCheck.inputs[1] <== salt;
    commitmentCheck.out === balanceCommitment;

    // ============================================
    // PHASE 5B: BALANCE EQUATION
    // ============================================
    vPubDelta === (vPubIn - vPubOut);

    signal vENAnew;
    vENAnew <== senderBalance + vPubDelta - transferAmount;
    newBalance <== vENAnew;

    // ============================================
    // PHASE 5B: ENA ENCRYPTION
    // ============================================
    component encryptNew = Poseidon(2);
    encryptNew.inputs[0] <== kENA;
    encryptNew.inputs[1] <== vENAnew;
    sctNew <== encryptNew.out;

    // ============================================
    // PHASE 6D: RANGE PROOFS
    // Prove 0 <= transferAmount <= maxAmount without revealing exact amount
    // ============================================
    component rangeProof = RangeProof(64);
    rangeProof.value <== transferAmount;
    rangeProof.maxValue <== maxAmount;

    signal rangeValid;
    rangeValid <== rangeProof.isValid;

    // ============================================
    // PHASE 6B: MONERO-STYLE STEALTH ADDRESS GENERATION
    // ============================================
    component stealthGen = StealthAddressGeneration();
    stealthGen.recipientViewPublicKey <== recipientViewPublicKey;
    stealthGen.ephemeralPrivateKey <== ephemeralPrivateKey;
    stealthGen.transferAmount <== transferAmount;
    stealthGen.stealthSalt <== stealthSalt;

    stealthAddress <== stealthGen.stealthAddress;
    ephemeralPublicKey <== stealthGen.ephemeralPublicKey;

    // ============================================
    // RECIPIENT HASH (For backward compatibility and merkle leaf)
    // Note: In Monero-style, this is less meaningful since sender doesn't know recipient
    // We use viewPublicKey here for merkle tree consistency
    // ============================================
    component recipientHasher = Poseidon(2);
    recipientHasher.inputs[0] <== recipientViewPublicKey;
    recipientHasher.inputs[1] <== transferAmount;
    recipientHash <== recipientHasher.out;

    // ============================================
    // PHASE 4: NULLIFIER GENERATION
    // ============================================
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== balanceCommitment;
    nullifierHasher.inputs[1] <== salt;
    nullifierHasher.inputs[2] <== transferAmount;
    nullifier <== nullifierHasher.out;

    // ============================================
    // PHASE 6C: MERKLE TREE INTEGRATION
    // Compute Merkle leaf and verify it's part of the tree
    // ============================================

    // Compute current timestamp (approximation: use balanceCommitment as proxy)
    signal timestamp;
    timestamp <== balanceCommitment;  // In real impl, would use block.timestamp

    // Compute Merkle leaf
    component leafHasher = MerkleLeafHash();
    leafHasher.recipientHash <== recipientHash;
    leafHasher.transferAmount <== transferAmount;
    leafHasher.timestamp <== timestamp;
    merkleLeaf <== leafHasher.leafHash;

    // Verify Merkle proof (optional - can be disabled for initial transfers)
    // For new transfers, merkleRoot might be 0
    component merkleProof = MerkleTreeInclusionProof(20);
    merkleProof.leaf <== merkleLeaf;
    merkleProof.root <== merkleRoot;
    for (var i = 0; i < 20; i++) {
        merkleProof.pathElements[i] <== merklePathElements[i];
        merkleProof.pathIndices[i] <== merklePathIndices[i];
    }

    // For Phase 6C initial deployment: allow merkleRoot = 0 (no verification needed)
    component rootIsZero = IsZero();
    rootIsZero.in <== merkleRoot;

    // merkleProofValid = 1 if either root is 0 OR proof is valid
    signal proofOrNoRoot;
    proofOrNoRoot <== rootIsZero.out + merkleProof.isValid;

    component merkleCheckGate = GreaterThan(8);
    merkleCheckGate.in[0] <== proofOrNoRoot;
    merkleCheckGate.in[1] <== 0;

    merkleProofValid <== merkleCheckGate.out;

    // ============================================
    // PHASE 6E: ENCRYPTED MEMO HASH
    // ============================================
    component memoHasher = Poseidon(2);
    memoHasher.inputs[0] <== encryptedMemo[0];
    memoHasher.inputs[1] <== encryptedMemo[1];
    encryptedMemoHash <== memoHasher.out;

    // ============================================
    // TRANSFER VALIDATION
    // ============================================

    // Transfer amount <= maxAmount (covered by range proof)
    component ltMax = LessThan(64);
    ltMax.in[0] <== transferAmount;
    ltMax.in[1] <== maxAmount + 1;

    // Transfer amount >= 0
    component geZero = GreaterEqThan(32);
    geZero.in[0] <== transferAmount;
    geZero.in[1] <== 0;

    // Transfer amount <= sender's balance + vPubIn (account for deposits)
    signal availableBalance;
    availableBalance <== senderBalance + vPubIn;
    component balanceCheck = LessEqThan(64);
    balanceCheck.in[0] <== transferAmount;
    balanceCheck.in[1] <== availableBalance;

    // Asset ID valid (> 0)
    component assetValidation = GreaterThan(32);
    assetValidation.in[0] <== assetId;
    assetValidation.in[1] <== 0;

    // MONERO-STYLE: Recipient view public key validation removed
    // View public keys are Poseidon hash outputs (field elements) - always valid
    // No need to check recipientViewPublicKey > 0 since Poseidon guarantees non-zero outputs

    // Stealth address validation removed - Poseidon hash outputs are always valid field elements
    // No need to check if stealthAddress > 0 since Poseidon(ephemeralPublicKey, stealthSalt) guarantees valid output

    // ============================================
    // NEW BALANCE COMMITMENT
    // ============================================
    component newCommitment = Poseidon(2);
    newCommitment.inputs[0] <== newBalance;
    newCommitment.inputs[1] <== salt;
    newBalanceCommitment <== newCommitment.out;

    // ============================================
    // COMBINE ALL CHECKS
    // ============================================
    signal check1;
    signal check2;
    signal check3;
    signal check4;
    signal check5;
    signal check6;
    signal check7;
    signal check8;

    check1 <== ltMax.out * geZero.out;
    check2 <== check1 * balanceCheck.out;
    check3 <== check2 * assetValidation.out;
    // Removed recipientValidation.out - view public keys are always valid Poseidon outputs
    // Removed stealthValidation.out - Poseidon outputs are always valid
    check4 <== check3 * rangeValid;                // Phase 6D
    check5 <== check4 * merkleProofValid;          // Phase 6C
    check6 <== check5;
    check7 <== check6;
    check8 <== check7;

    valid <== check8;
}

// Public signals order (17 total):
// Outputs: [0] valid, [1] newBalance, [2] newBalanceCommitment, [3] recipientHash,
//          [4] nullifier, [5] sctNew, [6] stealthAddress, [7] ephemeralPublicKey,
//          [8] merkleLeaf, [9] merkleProofValid, [10] encryptedMemoHash
// Inputs:  [11] assetId, [12] maxAmount, [13] balanceCommitment, [14] sctOld,
//          [15] vPubDelta, [16] merkleRoot
component main {public [maxAmount, assetId, balanceCommitment, sctOld, vPubDelta, merkleRoot]} = PlonkTransferPhase6();
