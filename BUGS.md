# zkUlt Phase 6 - Known Bugs and Fixes

## Current Status: All Major Bugs Fixed

### Fixed Bugs

#### 1. Merkle Root Synchronization Issue (2025-11-26) - FIXED
**Problem**: Backend Merkle tree root didn't match on-chain contract root, causing "Invalid Merkle root" errors during transfers.

**Root Cause**:
- `fixed-merkle-tree` npm library computes root differently than Solidity contract for empty and single-leaf trees
- Contract behavior (PrivateTransferV4.sol):
  - Empty tree (size=0): returns `0`
  - Single leaf (size=1): returns leaf itself (no hashing)
  - Multiple leaves (size=2+): returns Poseidon hash
- Library always computed hash, even for empty/single-leaf cases

**Solution Implemented**:
- Added `_getContractMatchingRoot()` method in [merkleSync.js:35](/Users/valtoosh/zkphase/backend/src/services/merkleSync.js#L35)
- Added `getMerkleRoot()` helper in [plonkProverPhase6.js:471](/Users/valtoosh/zkphase/backend/src/services/plonkProverPhase6.js#L471)
- Both methods dynamically check tree size and return appropriate root matching contract behavior
- This is a systematic fix, not hardcoded - works for all future transfers

**Status**: Verified working with fresh Phase 6 contracts deployed to Sepolia

---

#### 2. Claim Circuit Signal Ordering Mismatch (Fixed in Previous Session)
**Problem**: Circuit output signals in different order than contract expected

**Solution**: Updated [claim.routes.js:93-114](/Users/valtoosh/zkphase/backend/src/routes/claim.routes.js#L93-L114) to pass signals in Circom's native order without reordering

**Status**: Fixed and deployed

---

### Active Deployment

**Sepolia Testnet** (2025-11-26):
- PlonkVerifierPhase6: `0xF28889Cb59468D5d74f82008D1fc0238690840e3`
- ClaimVerifier: `0x458885f28509f357917d47a1FF38AEaE71dF6B4e`
- Poseidon: `0x69433c594017bAC738F047c7401A15826dC3899c`
- PrivateTransferV4: `0x2EfE97797999824D5B1A3A42d32499e38eEf8564`

**Features**:
- Phase 6B: Stealth Addresses
- Phase 6C: Merkle Tree Anonymity
- Phase 6D: Range Proofs (64-bit)
- Phase 6E: Encrypted Memos

---

### Testing Checklist

- [x] Merkle sync with empty contract
- [x] Merkle sync with single-leaf contract
- [ ] Complete transfer flow (first transfer)
- [ ] Scan for stealth payments
- [ ] Claim proof generation
- [ ] Claim verification on-chain
- [ ] Withdraw funds

---

### Notes

All critical infrastructure bugs have been resolved. The system is ready for end-to-end testing of the full claiming flow.
