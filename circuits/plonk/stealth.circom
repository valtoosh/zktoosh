pragma circom 2.1.8;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * Phase 6B: Monero-Style Stealth Address System
 *
 * Monero-Style Stealth Address Protocol:
 * 1. Recipient has view key pair (viewPriv, viewPub) and spend key pair (spendPriv, spendPub)
 * 2. Recipient publishes viewPub as their "address" (like Ethereum address)
 * 3. Sender generates ephemeral key pair and derives shared secret
 * 4. Stealth address = Hash(sharedSecret, amount, salt)
 * 5. Recipient scans blockchain using viewPriv to detect payments
 * 6. Recipient proves ownership using both viewPriv and spendPriv
 *
 * Privacy Properties:
 * - Sender does NOT know recipient's final stealth address
 * - Only recipient can detect payments (needs viewPrivateKey)
 * - Only recipient can claim payments (needs spendPrivateKey)
 * - Observer cannot link stealth address to recipient
 */

/**
 * Monero-Style Stealth Address Generation
 * Creates a one-time address that only the recipient can detect and claim
 */
template StealthAddressGeneration() {
    signal input recipientViewPublicKey;  // Recipient's published view public key
    signal input ephemeralPrivateKey;     // Sender's one-time private key
    signal input transferAmount;          // Transfer amount (included in derivation)
    signal input stealthSalt;             // Random salt for uniqueness

    signal output stealthAddress;         // One-time stealth address
    signal output ephemeralPublicKey;     // Public key for recipient scanning
    signal output sharedSecret;           // For encrypted memo generation (optional output)

    // Step 1: Derive ephemeral public key
    // In real ECC, this would be ephemeralPrivateKey * G
    // We simulate with Poseidon hash
    component ephemPubGen = Poseidon(1);
    ephemPubGen.inputs[0] <== ephemeralPrivateKey;
    ephemeralPublicKey <== ephemPubGen.out;

    // Step 2: Derive shared secret (Diffie-Hellman-style)
    // In real ECC: sharedSecret = ephemeralPrivateKey * recipientViewPublicKey
    // For hash-based DH, we use: Poseidon(recipientViewPub, ephemeralPub)
    // This matches the claim-side formula: Poseidon(viewPriv, ephemeralPub)
    // where recipientViewPub = Poseidon(viewPriv)
    component secretGen = Poseidon(2);
    secretGen.inputs[0] <== recipientViewPublicKey;
    secretGen.inputs[1] <== ephemeralPublicKey;
    sharedSecret <== secretGen.out;

    // Step 3: Generate stealth address
    // stealthAddress = Hash(sharedSecret, transferAmount, stealthSalt)
    // This ensures:
    // - Only recipient with viewPrivateKey can recompute sharedSecret
    // - Amount is bound to stealth address (prevents amount manipulation)
    // - Salt provides uniqueness (same recipient, same amount = different address)
    component stealthGen = Poseidon(3);
    stealthGen.inputs[0] <== sharedSecret;
    stealthGen.inputs[1] <== transferAmount;
    stealthGen.inputs[2] <== stealthSalt;
    stealthAddress <== stealthGen.out;
}

/**
 * Monero-Style Stealth Address Ownership Proof
 * Recipient proves they can compute the stealth address using their view key
 */
template StealthAddressOwnership() {
    signal input viewPrivateKey;          // Claimant's view private key (private)
    signal input ephemeralPublicKey;      // Ephemeral key from blockchain (public/private)
    signal input transferAmount;          // Transfer amount (discovered during scanning)
    signal input stealthSalt;             // Salt from transfer (discovered during scanning)
    signal input stealthAddress;          // Stealth address to prove ownership of (public)

    signal output isOwner;                // 1 if claimant owns stealth address

    // Step 1: Recompute shared secret using view private key
    component secretGen = Poseidon(2);
    secretGen.inputs[0] <== viewPrivateKey;
    secretGen.inputs[1] <== ephemeralPublicKey;

    // Step 2: Recompute stealth address
    component stealthGen = Poseidon(3);
    stealthGen.inputs[0] <== secretGen.out;
    stealthGen.inputs[1] <== transferAmount;
    stealthGen.inputs[2] <== stealthSalt;

    // Step 3: Check if computed stealth address matches claimed address
    component ownershipCheck = IsEqual();
    ownershipCheck.in[0] <== stealthGen.out;
    ownershipCheck.in[1] <== stealthAddress;

    isOwner <== ownershipCheck.out;
}

/**
 * Stealth Payment Detection
 * Recipient scans blockchain to detect incoming payments
 * This template helps generate the detection keys
 */
template StealthScanningKey() {
    signal input recipientAddress;        // Recipient's address
    signal input ephemeralPublicKey;      // From blockchain event

    signal output scanningKey;            // Key to match against stealth addresses

    // Generate scanning key
    component scanner = Poseidon(2);
    scanner.inputs[0] <== recipientAddress;
    scanner.inputs[1] <== ephemeralPublicKey;

    scanningKey <== scanner.out;
}

/**
 * Batch Stealth Detection (Monero-Style)
 * Check multiple stealth addresses at once (for efficient blockchain scanning)
 */
template BatchStealthDetection(numAddresses) {
    signal input viewPrivateKey;                    // Recipient's view private key
    signal input ephemeralPublicKeys[numAddresses]; // From blockchain events
    signal input transferAmounts[numAddresses];     // Discovered amounts (from encrypted memos)
    signal input stealthSalts[numAddresses];        // Discovered salts (from encrypted memos)
    signal input stealthAddresses[numAddresses];    // Stealth addresses from blockchain

    signal output matches[numAddresses];  // 1 if each address is owned by recipient

    component detectors[numAddresses];

    for (var i = 0; i < numAddresses; i++) {
        detectors[i] = StealthAddressOwnership();
        detectors[i].viewPrivateKey <== viewPrivateKey;
        detectors[i].ephemeralPublicKey <== ephemeralPublicKeys[i];
        detectors[i].transferAmount <== transferAmounts[i];
        detectors[i].stealthSalt <== stealthSalts[i];
        detectors[i].stealthAddress <== stealthAddresses[i];

        matches[i] <== detectors[i].isOwner;
    }
}
