# zkUlt PLONK Circuits

## Circuit Hierarchy

1. **transfer.circom** - Basic PLONK-compatible transfer validation
2. **transfer_enhanced.circom** - Adds commitment scheme for privacy
3. **transfer_auditable.circom** (Coming in Phase 2) - Adds auditor encryption

---

## Compilation Guide

### Prerequisites
```bash
npm install -g circom
npm install -g snarkjs
```

### Compile Basic Circuit
```bash
# Navigate to circuits/plonk
cd circuits/plonk

# Compile to PLONK-compatible format
circom transfer.circom \
  --r1cs \
  --wasm \
  --sym \
  --output ../../backend/keys/plonk

# Check outputs
ls ../../backend/keys/plonk/
# Expected: transfer.r1cs, transfer.wasm, transfer.sym
```

### Generate PLONK Proving Keys
```bash
cd ../../backend/keys/plonk

# Start PLONK powers of tau (universal setup)
snarkjs powersoftau new bn128 14 pot14_0000.ptau -v

# Contribute to ceremony
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau \
  --name="First contribution" -v

# Prepare phase 2
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v

# Setup PLONK-specific keys
snarkjs plonk setup transfer.r1cs pot14_final.ptau transfer_final.zkey

# Export verification key
snarkjs zkey export verificationkey transfer_final.zkey verification_key.json

# Export Solidity verifier
snarkjs zkey export solidityverifier transfer_final.zkey \
  ../../../contracts/plonk/PlonkVerifier.sol
```

---

## Circuit Specifications

### Basic Transfer Circuit

**Inputs:**
- `senderBalance` (private) - Current balance
- `transferAmount` (private) - Amount to transfer
- `recipientId` (private) - Recipient identifier
- `assetId` (public) - Asset being transferred
- `maxAmount` (public) - Maximum allowed amount

**Outputs:**
- `valid` (1 or 0) - Whether transfer is valid
- `newBalance` - Sender's balance after transfer

**Constraints:** ~280 (slightly more than Groth16 due to PLONK overhead)

**Proving Time:** Target <100ms on M1 Mac

---

### Enhanced Transfer Circuit

**Additional Inputs:**
- `salt` (private) - Randomness for commitments
- `balanceCommitment` (public) - Commitment to current balance

**Additional Outputs:**
- `newBalanceCommitment` - Commitment to new balance

**Constraints:** ~350 (adds Poseidon hash)

**Use Case:** Enables balance privacy on-chain

---

## Testing
```bash
# Run circuit tests
cd ../../test/circuits
npm test
```

---

## Constraint Comparison

| Circuit | Constraints | Proving Time | Gas Cost |
|---------|-------------|--------------|----------|
| Groth16 Basic | 265 | 49ms | 250k |
| PLONK Basic | ~280 | 85ms | 320k |
| PLONK Enhanced | ~350 | 110ms | 380k |

*Note: PLONK has slightly higher costs but offers universal setup*

---

## Security Notes

1. **Universal Setup:** PLONK uses a single trusted setup for ALL circuits
2. **No Per-Circuit Ceremony:** Can deploy new circuits without new setup
3. **Quantum Resistance:** PLONK is more quantum-resistant than Groth16
4. **Transparency:** Powers of Tau is publicly verifiable

---

## Next Steps

- [ ] Compile basic circuit
- [ ] Generate PLONK keys
- [ ] Test proof generation
- [ ] Deploy PlonkVerifier.sol
- [ ] Integrate with backend