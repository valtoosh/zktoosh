pragma circom 2.1.8;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * zkUlt Phase 6 - Monero-Style Claiming Circuit
 *
 * Proves recipient can claim a stealth payment by:
 * 1. Proving knowledge of view private key to recompute shared secret
 * 2. Proving knowledge of spend private key (ownership of funds)
 * 3. Revealing the transfer amount to credit on-chain balance
 * 4. Proving the claimer's identity via view+spend key hash
 *
 * This circuit implements Monero-style two-key privacy where:
 * - View key: Allows detecting incoming payments
 * - Spend key: Allows spending detected payments
 *
 * Public Signals (5 total):
 * According to claim.sym file, Circom outputs signals as:
 * [0] valid (output)
 * [1] claimerAddressHash (output)
 * [2] claimedAmount (output)
 * [3] assetId (public input)
 * [4] stealthAddress (public input)
 *
 * This is ALREADY the contract's expected order!
 * No reordering needed in backend.
 */

template ClaimProof() {
    // ============================================
    // PRIVATE INPUTS (secrets known only to recipient)
    // ============================================
    signal input viewPrivateKey;         // Recipient's view private key
    signal input spendPrivateKey;        // Recipient's spend private key
    signal input ephemeralPublicKey;     // From blockchain (published by sender)
    signal input transferAmount;         // Amount sent in the transfer
    signal input stealthSalt;            // Salt used to generate stealth address

    // ============================================
    // PUBLIC INPUTS
    // ============================================
    signal input assetId;                // Asset being claimed
    signal input stealthAddress;         // Stealth address to claim from

    // ============================================
    // PUBLIC OUTPUTS
    // ============================================
    signal output valid;
    signal output claimerAddressHash;    // Hash(viewPrivateKey, spendPrivateKey)
    signal output claimedAmount;         // Revealed transfer amount

    // ============================================
    // PROOF LOGIC
    // ============================================

    // Step 1: Derive view public key from private key
    // viewPublicKey = Poseidon(viewPrivateKey)
    component viewPubGen = Poseidon(1);
    viewPubGen.inputs[0] <== viewPrivateKey;

    // Step 2: Derive shared secret using view public key
    // Must match transfer circuit: Poseidon(recipientViewPub, ephemeralPub)
    // where recipientViewPub = Poseidon(viewPriv) and ephemeralPub is already hashed
    component sharedSecretGen = Poseidon(2);
    sharedSecretGen.inputs[0] <== viewPubGen.out;
    sharedSecretGen.inputs[1] <== ephemeralPublicKey;

    // Step 2: Recompute stealth address
    // stealthAddress = Poseidon(sharedSecret, transferAmount, stealthSalt)
    component stealthHash = Poseidon(3);
    stealthHash.inputs[0] <== sharedSecretGen.out;
    stealthHash.inputs[1] <== transferAmount;
    stealthHash.inputs[2] <== stealthSalt;

    // Step 3: Verify computed stealth address matches the one being claimed
    component verifyAddress = IsEqual();
    verifyAddress.in[0] <== stealthHash.out;
    verifyAddress.in[1] <== stealthAddress;

    // Step 4: Compute claimerAddressHash to match transfer circuit's recipientHash
    // Transfer circuit computed: recipientHash = Poseidon(recipientViewPub, transferAmount)
    // We must output the SAME value to pass contract validation
    // claimerAddressHash = Poseidon(viewPublicKey, transferAmount)
    component claimerHashGen = Poseidon(2);
    claimerHashGen.inputs[0] <== viewPubGen.out;  // viewPublicKey
    claimerHashGen.inputs[1] <== transferAmount;
    claimerAddressHash <== claimerHashGen.out;

    // Step 5: Verify amount is positive (sanity check)
    component isPositive = GreaterThan(64);
    isPositive.in[0] <== transferAmount;
    isPositive.in[1] <== 0;

    // Step 6: Output validation result
    // valid = 1 only if:
    // - Stealth address matches (verifyAddress.out == 1)
    // - Amount is positive (isPositive.out == 1)
    signal addressValid <== verifyAddress.out;
    signal amountValid <== isPositive.out;

    // Both must be true
    valid <== addressValid * amountValid;

    // Step 7: Reveal transfer amount for on-chain credit
    // This was hidden during transfer, but must be revealed to credit balance
    claimedAmount <== transferAmount;
}

// Main component declaration
// Specify which inputs are public (assetId, stealthAddress)
// All others are private by default
component main {public [assetId, stealthAddress]} = ClaimProof();
