# zkUlt Phase 6 - Session Notes

## Session 2025-11-27: Claim Circuit Fix & Privacy Enhancement

### Objective
Fix claim circuit validation and privacy issues, deploy fresh contracts with correct claiming flow.

### Problems Encountered

1. **Claim Circuit Hash Mismatch**
   - Transfer circuit computes: `recipientHash = Poseidon(recipientViewPub, transferAmount)`
   - Claim circuit was computing: `claimerAddressHash = Poseidon(viewPrivateKey, spendPrivateKey)`
   - Contract validation: `require(payment.encryptedAmount == claimerAddress, "Invalid encrypted amount")`
   - These values didn't match, causing all claims to fail

2. **Privacy Issue: Deposits Creating Stealth Payments**
   - Contract was creating stealth payment entries for ALL transfers, including deposits
   - Deposits (EOA → ENA) are not transfers to other people, shouldn't create claimable payments
   - This created noise in the stealth payment list and potential privacy leaks

3. **Missing updateClaimVerifier Function**
   - Contract had `updateVerifier()` for transfer verifier but not claim verifier
   - Couldn't update claim verifier without full contract redeployment

### Solutions Implemented

1. **Fixed Claim Circuit Hash Computation**
   - Location: [circuits/plonk/claim.circom:82-89](/Users/valtoosh/zkphase/circuits/plonk/claim.circom#L82-L89)
   - Changed from: `claimerAddressHash = Poseidon(viewPrivateKey, spendPrivateKey)`
   - Changed to: `claimerAddressHash = Poseidon(viewPublicKey, transferAmount)`
   - Now matches transfer circuit's `recipientHash` computation exactly
   - Recompiled claim circuit with `./compile-claim.sh`

2. **Fixed Privacy Issue**
   - Location: [contracts/plonk/PrivateTransferV4.sol:249-272](/Users/valtoosh/zkphase/contracts/plonk/PrivateTransferV4.sol#L249-L272)
   - Added conditional: `if (stealthAddress != 0)` before creating stealth payment
   - Only creates stealth payments for pure ENA transfers (vPubDelta == 0)
   - Deposits (vPubDelta > 0) no longer create stealth payments
   - Moved StealthPaymentCreated event inside the conditional

3. **Added updateClaimVerifier Function**
   - Location: [contracts/plonk/PrivateTransferV4.sol:522-525](/Users/valtoosh/zkphase/contracts/plonk/PrivateTransferV4.sol#L522-L525)
   - Added owner-only function to update claim verifier address
   - Matches existing `updateVerifier()` pattern
   - Enables updating claim verifier without full redeployment

### Fresh Deployment #3 (Sepolia) - ALL FIXES APPLIED

Deployed at: 2025-11-27

**Contract Addresses:**
- PlonkVerifierPhase6: `0x88E6A90c099809647c5164464f980E8109bB394B`
- ClaimVerifier: `0x63Ade6E45c012E336DC1A5297EBaD8a8369b4C1C`
- Poseidon: `0x3b3B814C9D26B3Aad586F6BA326808A0A4d265B0`
- PrivateTransferV4: `0x51cC96fFD6cA1B73e18030Aa78A62699F2b14903`

**Etherscan:**
- [Transfer Contract](https://sepolia.etherscan.io/address/0x51cC96fFD6cA1B73e18030Aa78A62699F2b14903)
- [Transfer Verifier](https://sepolia.etherscan.io/address/0x88E6A90c099809647c5164464f980E8109bB394B)
- [Claim Verifier](https://sepolia.etherscan.io/address/0x63Ade6E45c012E336DC1A5297EBaD8a8369b4C1C)

**Backend Status:** Running with latest code (all fixes applied)
**Frontend Config:** Auto-updated by deployment script
**Claim Circuit:** Recompiled with correct hash computation

### Key Changes Summary

1. Claim circuit now computes hash to match transfer circuit
2. Privacy enhanced - deposits no longer create stealth payments
3. Contract now supports updating claim verifier via admin function
4. All verifiers and contracts freshly deployed with fixes

### Testing & Verification

**Test Sequence Executed:**
1. ✅ **Deposit (10 ENA)** - No stealth payment created (privacy fix working!)
2. ✅ **Transfer (6 ENA)** - Stealth payment #0 created successfully
3. ✅ **Claim (6 ENA)** - Claim proof validated and credited successfully
4. ✅ **Withdraw** - Funds withdrawn successfully

**On-Chain Verification (Sepolia):**
- Scanned contract: `0x51cC96fFD6cA1B73e18030Aa78A62699F2b14903`
- Total stealth payments: **1** (only the transfer, NOT the deposit!)
- Payment #0: Stealth Address `1541627079323966757...`, Claimed: `true`
- Timestamp: 2025-11-27T07:18:24.000Z

**Merkle Root Debugging:**
- Added enhanced logging in plonkProverPhase6.js (lines 256-277)
- Verified `getMerkleRoot()` correctly returns "0" for empty tree
- `fixed-merkle-tree` library returns wrong value (5424254963943467...) which is overridden
- Circuit received correct merkleRoot = 0
- Merkle proof validation passed: `merkleProofValid: 1`

**Backend Logs:**
- Proof generation time: ~38 seconds
- All circuit validations passed
- Backend Merkle tree synced correctly with contract

### All Issues RESOLVED ✅

1. ✅ **Claim Circuit Hash Mismatch** - Fixed, claim succeeded
2. ✅ **Privacy Issue** - Confirmed working on-chain (only 1 stealth payment for 1 transfer)
3. ✅ **Merkle Root Sync** - Enhanced logging confirms correct behavior
4. ✅ **Complete Flow** - Deposit → Transfer → Claim → Withdraw all working

### Technical Notes

- The claim circuit fix ensures `claimerAddressHash` matches the `recipientHash` stored by the transfer circuit
- This is critical for the contract validation: `payment.encryptedAmount == claimerAddress`
- Privacy fix prevents deposit transactions from creating claimable stealth payments
- System now properly distinguishes between deposits (self-transfer) and transfers (to others)
- **Key Insight:** The `if (stealthAddress != 0)` conditional correctly filters deposits because:
  - Deposits: User sets `stealthAddress = 0` in transfer parameters
  - Transfers: User provides recipient's computed stealth address (non-zero)
  - Contract only creates stealth payment when `stealthAddress != 0`

---

## Session 2025-11-26: Merkle Root Sync Fix & Fresh Deployment

### Objective
Fix "Invalid Merkle root" error and deploy fresh Phase 6 contracts with working claim flow.

### Problems Encountered

1. **Merkle Root Mismatch**
   - Backend Merkle tree root didn't match on-chain contract root
   - Contract had 1 leaf, backend computed different root after syncing
   - Root cause: `fixed-merkle-tree` library's root calculation differs from Solidity contract for edge cases

2. **Empty/Single-Leaf Tree Behavior**
   - Contract (PrivateTransferV4.sol):
     - Empty tree: returns `0`
     - Single leaf: returns leaf itself (no hashing)
     - Multiple leaves: returns Poseidon hash
   - Library: Always computes hash chain, even for empty/single-leaf trees

### Solutions Implemented

1. **Created `_getContractMatchingRoot()` in merkleSync.js**
   - Location: [backend/src/services/merkleSync.js:35](/Users/valtoosh/zkphase/backend/src/services/merkleSync.js#L35)
   - Dynamically checks tree size and returns appropriate root
   - Matches contract behavior exactly

2. **Created `getMerkleRoot()` in plonkProverPhase6.js**
   - Location: [backend/src/services/plonkProverPhase6.js:471](/Users/valtoosh/zkphase/backend/src/services/plonkProverPhase6.js#L471)
   - Same logic as merkleSync, but for PlonkProverPhase6 wrapper

3. **Updated All Root Access Points**
   - All `.root` access now uses helper methods
   - Ensures consistent behavior across the application

### Verification

Backend successfully syncs with both:
- Empty contract (size=0): `Root: 0, Size: 0`
- Single-leaf contract (size=1): `Root: <leaf_value>, Size: 1`

### Fresh Deployment #2 (Sepolia) - ALL FIXES APPLIED

Deployed at: 2025-11-26 (Evening)

**Contract Addresses:**
- PlonkVerifierPhase6: `0x8AB07d3B33Eb0584BC91e3c71d5FBDa84c12011a`
- ClaimVerifier: `0x82AEe369FD0D3A44E556B05123CdF29f6c7835F7`
- Poseidon: `0x705afe73831673A826A5d3D073Ba92dCE193f269`
- PrivateTransferV4: `0x563082505765FF12E6f7EAC1212793C06170382b`

**Etherscan:**
- [Transfer Contract](https://sepolia.etherscan.io/address/0x563082505765FF12E6f7EAC1212793C06170382b)
- [Transfer Verifier](https://sepolia.etherscan.io/address/0x8AB07d3B33Eb0584BC91e3c71d5FBDa84c12011a)
- [Claim Verifier](https://sepolia.etherscan.io/address/0x82AEe369FD0D3A44E556B05123CdF29f6c7835F7)

**Backend Status:** Running with latest code (Merkle root fix + privacy fix)
**Frontend Config:** Auto-updated by deployment script
**Merkle Tree:** Synced (empty, root=0, size=0)

### Next Steps

1. Test complete transfer flow with fresh Monero-style keys
2. Scan for stealth payments
3. Generate claim proof
4. Submit claim transaction
5. Withdraw funds

### Technical Notes

- The Merkle root fix is **systematic, not hardcoded** - it will work for all future transfers without modification
- The fix works by dynamically checking tree size and returning the appropriate root based on the contract's exact behavior
- This ensures backend and contract always stay in sync, regardless of tree state

---

## Previous Sessions

See [BUGS.md](/Users/valtoosh/zkphase/BUGS.md) for historical bug fixes and deployment history.

---

## Architecture Overview

**Frontend** → **Backend (Proof Server)** → **Sepolia Testnet**

- **Frontend**: React app for user interaction
- **Backend**: Express server generating PLONK proofs, managing Merkle tree
- **Contracts**: Solidity contracts on Sepolia for on-chain verification

**Privacy Features:**
- Stealth Addresses (Phase 6B)
- Merkle Anonymity (Phase 6C)
- Range Proofs (Phase 6D)
- Encrypted Memos (Phase 6E)

**Claiming Flow:**
1. User receives stealth payment (only they can detect using view key)
2. User scans blockchain for payments (client-side)
3. User generates claim proof (using spend key)
4. User submits claim transaction (on-chain verification)
5. User withdraws funds to their address
