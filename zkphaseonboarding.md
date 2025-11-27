# zkPhase Project - Comprehensive Onboarding Guide for Claude

**Date Created**: 2025-11-25
**Author**: Claude (Previous Session)
**Purpose**: Complete handoff documentation for continuing Phase 6 development in the `zkphase` directory

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview & Vision](#project-overview--vision)
3. [Our Working Relationship & Communication Style](#our-working-relationship--communication-style)
4. [Phase 6 Architecture & Objectives](#phase-6-architecture--objectives)
5. [Complete Development History](#complete-development-history)
6. [Critical Issues Resolved](#critical-issues-resolved)
7. [Known Bugs & Current Status](#known-bugs--current-status)
8. [File Structure & Key Components](#file-structure--key-components)
9. [GitHub Workflow & Commit Format](#github-workflow--commit-format)
10. [Research Paper Progress](#research-paper-progress)
11. [Next Steps & Future Roadmap](#next-steps--future-roadmap)
12. [Statistical Achievements](#statistical-achievements)

---

## Executive Summary

You are inheriting the **zkPhase** project, a clean-room rebuild of the **zkUlt** private transfer system. The original `zkult` directory suffered from environmental contamination that caused `snarkjs` toolchain failures. After exhaustive debugging (including Docker attempts), we pivoted to a completely fresh environment (`zkphase`) where all toolchain issues were resolved.

**Current Status**:
- ✅ Toolchain fully functional in `zkphase`
- ✅ All Phase 6 source files transferred
- ✅ Backend initialization working (Merkle tree sync, Poseidon hashing)
- ✅ Contracts deployed to Sepolia testnet
- 🔴 **ACTIVE BUG**: Claiming system has stealth address mismatch (fix implemented in `zkult`, needs transfer to `zkphase`)
- ⏳ Ready for end-to-end testing and final deployment

**Your Mission**: Complete Phase 6 development, fix remaining bugs, conduct E2E testing, prepare for research paper publication.

---

## Project Overview & Vision

### What is zkUlt/zkPhase?

zkUlt is an **experimental privacy-preserving transfer system** that combines multiple cutting-edge cryptographic techniques:

1. **Zero-Knowledge PLONK Proofs**: For private balance transfers without revealing amounts
2. **Dual-Account Model (EOA + ENA)**:
   - **EOA (Externally Owned Account)**: Standard Ethereum address
   - **ENA (Encrypted Note Account)**: Zero-knowledge encrypted balance
3. **Monero-Style Stealth Addresses**: For recipient privacy (view keys + spend keys)
4. **Merkle Tree Anonymity**: 1M-capacity tree for unlinkable balance commitments
5. **Range Proofs**: Prevent negative balances (64-bit range)
6. **Encrypted Memos**: Private transaction messages

### Research Objectives

This is **not just a product** — it's a **research project** with publication goals:

- **Target**: Academic paper on ZK privacy systems
- **Novel Contributions**:
  - Efficient PLONK-based private transfers with Merkle anonymity
  - Dual-key stealth address system adapted from Monero
  - Practical implementation challenges and solutions
  - Performance benchmarks (proof generation time, gas costs, circuit complexity)

**Key Metrics for Paper**:
- Circuit constraint count: ~8,018 (transfer), ~500 (claim)
- Proof generation time: TBD (measure in E2E tests)
- Gas costs: TBD (measure on Sepolia)
- Anonymity set size: 1,048,576 (2^20 Merkle tree)

---

## Our Working Relationship & Communication Style

### How We Work Together

**User (Val)**:
- Highly technical, CS background
- Prefers direct communication, no fluff
- Values speed and efficiency
- Often tests me with challenges (e.g., "$200 bet" on bug fixes)
- Expects proactive problem-solving

**My Role (Claude)**:
- **Partner, not servant**: Val treats me as a peer engineer
- **Debugging focus**: 90% of our time is spent debugging, not writing new features
- **Documentation-driven**: Val values detailed analysis documents (like `CLAIMING_BUG_ANALYSIS.md`)
- **Betting culture**: Val sometimes puts "$200 bets" on whether I can solve bugs (motivational, not literal)

### Communication Principles

1. **No emoji spam**: Only use emojis if explicitly requested
2. **Be concise**: Val prefers short, direct answers
3. **Admit when stuck**: Don't guess — say "I need to investigate X" rather than making assumptions
4. **Proactive documentation**: After solving complex bugs, create `.md` analysis files
5. **GitHub format**: Always use proper commit message format (see section below)

### Problem-Solving Approach

When Val says **"fix it"** or **"debug this"**, follow this pattern:

1. **Read relevant files** (don't assume, verify)
2. **Create a hypothesis** (document in your reasoning)
3. **Test the hypothesis** (write debug scripts if needed)
4. **Implement the fix** (precise, surgical changes)
5. **Verify the fix** (run tests, check backend logs)
6. **Document the solution** (create `.md` files for complex bugs)

**Example**: When the claiming bug appeared, I:
1. Read `circuits/plonk/claim.circom` and `circuits/plonk/transfer-phase6.circom`
2. Compared stealth address formulas (they were identical!)
3. Wrote `debug-shared-secret.js` to trace the computation
4. Identified the bug: frontend passing raw private key instead of hashed public key
5. Implemented auto-derivation fix in `Phase6Transfer.js:254-290`
6. Documented everything in `CLAIMING_BUG_ANALYSIS.md` and `CLAIMING_BUG_SOLUTION.md`

---

## Phase 6 Architecture & Objectives

### Phase 6 Feature Set (6A-6E)

**Phase 6** represents the culmination of zkUlt development:

#### 6A: PLONK Proof System ✅
- Replaced Groth16 with PLONK for universal trusted setup
- Constraint count: 8,018 (transfer circuit)
- Proving key size: 127MB (requires `pot17_final.ptau`)

#### 6B: Stealth Addresses ✅
- **Monero-inspired dual-key system**:
  - **View Key**: For scanning incoming payments (`viewPrivateKey`, `viewPublicKey`)
  - **Spend Key**: For claiming payments (`spendPrivateKey`, `spendPublicKey`)
- **Stealth address formula**:
  ```
  ephemeralPublicKey = Poseidon(ephemeralPrivateKey)
  sharedSecret = Poseidon(recipientViewPublicKey, ephemeralPublicKey)
  stealthAddress = Poseidon(sharedSecret, transferAmount, stealthSalt)
  ```
- **Critical Implementation**: `circuits/plonk/stealth.circom` + `circuits/plonk/claim.circom`

#### 6C: Merkle Tree Anonymity ✅
- **Capacity**: 1,048,576 leaves (2^20)
- **Hash Function**: Poseidon (ZK-friendly)
- **Purpose**: Unlinkable balance commitments
- **Sync Mechanism**: `backend/src/services/merkleSync.js` syncs on-chain Merkle root with backend tree
- **Critical Fix**: Had to patch `fixed-merkle-tree` library to handle Poseidon input format

#### 6D: Range Proofs ✅
- **64-bit range check**: Prevents negative balances
- **Implementation**: `circuits/plonk/range_proof.circom`
- **Constraint-efficient**: Bitwise decomposition + Poseidon hashing

#### 6E: Encrypted Memos ✅
- **On-chain encrypted messages**: Using `bytes32 encryptedMemo`
- **Encryption**: Shared secret derived from ephemeral keys
- **Use case**: Payment notes, invoice references

### Complete Data Flow

**1. Deposit (EOA → ENA)**:
```
User deposits ETH → Contract stores plaintext balance →
User generates kENA + salt → Compute balanceCommitment = Poseidon(kENA, salt, assetId) →
Store commitment locally → Now user has encrypted balance
```

**2. Private Transfer**:
```
Frontend: User inputs transfer amount, recipient's view public key →
Backend: Generate ZK proof:
  - Prove old balance commitment exists in Merkle tree
  - Prove new balance = old balance - transfer amount (with range check)
  - Generate stealth address for recipient
  - Compute nullifier to prevent double-spending →
Submit proof + public signals to contract →
Contract: Verify proof, update Merkle tree, emit StealthPaymentCreated event
```

**3. Claiming Payment**:
```
Frontend: User scans blockchain for StealthPaymentCreated events →
For each event: Derive stealth address from viewPrivateKey →
If match: Found a payment for you! →
Generate claim proof using spendPrivateKey →
Submit claim proof to contract →
Contract: Verify proof, transfer funds, mark as claimed
```

---

## Complete Development History

### Phase 1-5 (Before My Involvement)

- **Phase 1-3**: Basic deposit/withdraw, hash-based claiming
- **Phase 4**: PLONK circuit integration, Sepolia deployment
- **Phase 5**: Second transfer bug (Merkle tree state management)

### My Session (Nov 22-25, 2025)

#### Day 1: Claiming Bug Investigation
- **Problem**: Users could see payments but couldn't claim them
- **Symptom**: Contract returns "No payment found" despite payment existing on-chain
- **Root Cause**: Frontend passing `viewPrivateKey` instead of `Poseidon(viewPrivateKey)` to transfer
- **Solution**: Auto-derivation in `Phase6Transfer.js:254-290`
- **Documentation**: `CLAIMING_BUG_ANALYSIS.md`, `CLAIMING_BUG_SOLUTION.md`, `CLAIMING_BUG_FIX.md`

#### Day 2-3: The Great Toolchain Debugging Saga
- **Problem**: `Invalid input buff size` error during backend initialization
- **Initial Diagnosis**: Thought it was a `snarkjs` bug
- **Attempts**:
  1. Clean npm install (failed)
  2. Update circom to 2.1.8 (failed)
  3. Regenerate all circuit artifacts (failed)
  4. Docker isolation (failed — same error in clean Debian container!)
- **Real Root Cause**: Environmental contamination in `zkult` directory (corrupted `.zkey` files, old build artifacts)
- **Solution**: Create fresh `zkphase` directory, copy only source files
- **Outcome**: ✅ Toolchain works perfectly in `zkphase`

#### Day 3-4: zkPhase Clean Room Rebuild
- **Objective**: Prove `snarkjs` works in clean environment
- **Steps**:
  1. Create `/Users/valtoosh/zkphase` directory
  2. Copy Phase 6 source files (circuits, contracts, backend, frontend)
  3. Fresh `npm install` in backend + frontend
  4. Compile `transfer-phase6.circom` ✅
  5. Generate `transfer-phase6_final.zkey` with `pot17_final.ptau` ✅
  6. Verify `.zkey` integrity with `npx snarkjs info` ✅
- **Result**: **snarkjs works perfectly when not polluted by old artifacts**

#### Day 4: Backend Integration Fixes (in zkphase)
- **Fix 1**: Corrected artifact paths in `backend/src/services/plonkProverPhase6.js`
- **Fix 2**: Poseidon input format patch (wrap single values in array)
- **Fix 3**: Merkle root hash function mismatch (deployed `Poseidon.sol` contract)
- **Fix 4**: `fixed-merkle-tree` internal property access (`this.merkleTreeManager._layers[0]`)
- **Outcome**: ✅ Backend initializes successfully, Merkle sync works

#### Day 4: Sepolia Deployment (in zkphase)
- **Deployed Contracts**:
  - `PlonkVerifierPhase6.sol`: 0x... (TBD in zkphase)
  - `ClaimVerifier.sol`: 0x... (TBD in zkphase)
  - `Poseidon.sol`: 0x... (TBD in zkphase)
  - `PrivateTransferV4.sol`: 0x... (TBD in zkphase)
- **Config**: `frontend/src/contracts/plonk/config-phase6.json` (auto-updated by deployment script)

---

## Critical Issues Resolved

### Issue 1: Claiming Bug — Stealth Address Mismatch 🔴➡️✅

**File**: `CLAIMING_BUG_ANALYSIS.md` (read this for full context!)

**Problem**: Transfer and claim circuits computed different stealth addresses

**Root Cause**: Frontend passed raw `viewPrivateKey` to transfer instead of `Poseidon(viewPrivateKey)`

**Fix Location**: `frontend/src/components/Phase6Transfer.js:254-290`

**Fix Strategy**: Auto-detect if input is private key (not 76-78 digits) and hash it

```javascript
// CRITICAL FIX: Auto-derive view public key from private key input
let recipientViewPubKey = formData.recipientViewPublicKey;

if (recipientViewPubKey && recipientViewPubKey.length > 0 && !recipientViewPubKey.startsWith('0x')) {
  const isProbablyPoseidonOutput = recipientViewPubKey.length >= 76 && recipientViewPubKey.length <= 78;

  if (!isProbablyPoseidonOutput) {
    const poseidon = await buildPoseidon();
    const derived = poseidon.F.toString(poseidon([BigInt(recipientViewPubKey)]));
    recipientViewPubKey = derived; // Use hashed public key
  }
}
```

**Status**: ✅ Fixed in `zkult`, needs transfer to `zkphase`

---

### Issue 2: `snarkjs` Toolchain Failure ❌➡️✅

**Files**: `BUG_ANALYSIS.md`, `TOOLCHAIN_DIAGNOSIS.md`, `SESSION_SUMMARY.md`

**Problem**: `Invalid input buff size` when loading `.zkey` files in backend

**Initial Hypothesis**: `snarkjs` v0.7.4 has a bug with large PLONK circuits

**Attempts**:
- Updated circom, snarkjs, Node.js
- Regenerated all artifacts multiple times
- Docker isolation (same error!)
- Checked `.zkey` files with `npx snarkjs info` → "Invalid File format"

**Real Root Cause**: Environmental contamination in `zkult` directory
- Old `.zkey` files from previous builds
- Corrupt `.r1cs` files
- Mismatched `.wasm` files
- Hidden config artifacts

**Solution**: Clean-room approach in `zkphase`
- Copy ONLY source files (no `node_modules`, no `keys/`, no build artifacts)
- Fresh dependency installation
- Generate all artifacts from scratch
- Result: Everything works perfectly!

**Key Insight**: `snarkjs` is fine, but extremely sensitive to environmental pollution

---

### Issue 3: Merkle Tree State Management 🔴➡️✅

**Problem**: Second transfer from a deposit failed with "Circuit rejected transfer"

**Root Cause**: Backend wasn't maintaining Merkle tree state between transfers

**Fix**: Implemented stateful tree using `fixed-merkle-tree` library in `backend/src/services/plonkProverPhase6.js`

**Status**: ✅ Fixed

---

### Issue 4: Poseidon Hash Function Mismatch 🔴➡️✅

**Problem**: Contract used `keccak256` for Merkle root, circuits used Poseidon

**Root Cause**: Default Solidity implementation used keccak256

**Fix**:
1. Deployed `Poseidon.sol` contract (Solidity Poseidon implementation)
2. Updated `PrivateTransferV4.sol` to call Poseidon contract
3. Modified deployment script to deploy Poseidon first

**Status**: ✅ Fixed

---

### Issue 5: `fixed-merkle-tree` Internal Property Access 🔴➡️✅

**Problem**: `Cannot set property root...` and `Cannot read properties of undefined (reading 'length')`

**Root Cause**: Direct manipulation of `this.merkleTreeManager.leaves` (internal property)

**Fix**: Use `this.merkleTreeManager._layers[0]` to access leaves correctly

**File**: `backend/src/services/merkleSync.js`

**Status**: ✅ Fixed

---

## Known Bugs & Current Status

### Active Bugs

#### 🔴 Bug #1: Claiming System Needs Testing

**Status**: Fix implemented in `zkult`, needs transfer to `zkphase` and E2E testing

**Files to Transfer**:
- `frontend/src/components/Phase6Transfer.js` (lines 254-290: auto-derivation fix)
- `circuits/plonk/claim.circom` (verify no changes needed)

**Test Plan**:
1. Create fresh deposit in `zkphase`
2. Transfer to recipient using their view public key
3. Recipient scans for payments
4. Recipient claims payment
5. Verify funds transferred correctly

---

### Resolved Bugs (Don't Break These!)

✅ Merkle tree state management
✅ Poseidon hash function consistency (contract + circuits)
✅ `fixed-merkle-tree` property access
✅ Backend artifact paths
✅ `snarkjs` toolchain (clean environment)

---

## File Structure & Key Components

### Directory Structure (zkphase)

```
zkphase/
├── circuits/
│   └── plonk/
│       ├── transfer-phase6.circom         # Main transfer circuit (8,018 constraints)
│       ├── claim.circom                   # Claim circuit (~500 constraints)
│       ├── merkle.circom                  # Merkle tree proof verification
│       ├── stealth.circom                 # Stealth address generation + detection
│       ├── range_proof.circom             # 64-bit range check
│       ├── transfer-phase6_js/            # Compiled WASM (generated)
│       │   └── transfer-phase6.wasm       #