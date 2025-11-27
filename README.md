# zkToosh - Phase 6: Monero-Style Private Transfers

**Production-ready zero-knowledge private transfer system with Monero-inspired stealth addresses, dual-key cryptography, and complete claiming flow on Ethereum.**

[![Phase 6](https://img.shields.io/badge/Phase%206-Complete-brightgreen)]() [![Sepolia](https://img.shields.io/badge/Sepolia-Deployed-blue)]() [![PLONK](https://img.shields.io/badge/ZK-PLONK-purple)]() [![Stealth](https://img.shields.io/badge/Stealth-Addresses-orange)]()

## 🌟 Phase 6 Features

### **Monero-Style Privacy System**
- **Dual-Key Cryptography** - Separate view keys (scanning) and spend keys (claiming)
- **Stealth Addresses** - Unique one-time addresses for each payment recipient
- **Payment Scanning** - Recipients scan blockchain privately using view key
- **Zero-Knowledge Claiming** - Claim payments without revealing identity
- **Privacy-Enhanced Deposits** - Deposits don't create stealth payment noise

### **Complete Privacy Flow**
- ✅ **Deposit** - EOA → ENA (encrypted private balance)
- ✅ **Transfer** - Create stealth payment with ephemeral keys
- ✅ **Scan** - Detect incoming payments using view key (client-side)
- ✅ **Claim** - Generate ZK proof to claim funds using spend key
- ✅ **Withdraw** - ENA → EOA (back to public balance)

### **Advanced Features**
- ✅ **Merkle Tree Anonymity** - Pending transfers in anonymity set (20 levels, ~1M capacity)
- ✅ **Range Proofs** - Amount validation without revealing values
- ✅ **Encrypted Memos** - Private messages attached to transfers
- ✅ **Balance Commitments** - Poseidon commitments for encrypted balances
- ✅ **Nullifier System** - Replay attack prevention
- ✅ **Rate Limiting** - DoS protection

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Frontend  │─────▶│   Backend    │─────▶│  Smart Contract │
│   (React)   │      │  (Express)   │      │   (Sepolia)     │
└─────────────┘      └──────────────┘      └─────────────────┘
      │                     │                       │
      │              ┌──────┴──────┐                │
      │              │             │                │
      │         ┌────▼────┐  ┌─────▼─────┐         │
      │         │ Transfer│  │   Claim   │         │
      │         │ Prover  │  │  Prover   │         │
      │         │ (Phase6)│  │ (Monero)  │         │
      │         └────┬────┘  └─────┬─────┘         │
      │              │             │                │
      └──────────────┴─────────────┴────────────────┘
                   Circom Circuits
         (transfer-phase6.circom + claim.circom)
```

## 🔑 Monero-Style Key System

### Dual-Key Design
```
Master Seed (32 bytes)
    │
    ├─▶ View Private Key ────▶ View Public Key (scan blockchain)
    │                               │
    │                               └─▶ Stealth Address Generation
    │
    └─▶ Spend Private Key ───▶ Spend Public Key (claim payments)
                                    │
                                    └─▶ Zero-Knowledge Claim Proofs
```

### Privacy Flow
1. **Sender** generates ephemeral key pair
2. **Sender** computes recipient's stealth address: `stealthAddr = f(ephemeralPub, recipientViewPub)`
3. **Sender** creates on-chain stealth payment with encrypted amount
4. **Recipient** scans blockchain with view key to detect payments
5. **Recipient** generates claim proof with spend key to unlock funds
6. **Contract** verifies proof and credits recipient's ENA balance

## 🚀 Quick Start

### Prerequisites
- Node.js v20.x or higher
- npm or yarn
- Git
- MetaMask wallet
- Sepolia testnet ETH

### Installation

```bash
# Clone repository
git clone https://github.com/valtoosh/zktoosh.git
cd zktoosh

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Generate Monero-Style Keys

```bash
# Generate your dual-key pair
cd backend
node -e "
const crypto = require('crypto');
const { buildPoseidon } = require('circomlibjs');

async function generateKeys() {
  const poseidon = await buildPoseidon();

  // Master seed
  const seed = crypto.randomBytes(32);

  // Derive keys
  const viewPriv = '0x' + crypto.createHash('sha256').update(Buffer.concat([seed, Buffer.from('view')])).digest('hex');
  const spendPriv = '0x' + crypto.createHash('sha256').update(Buffer.concat([seed, Buffer.from('spend')])).digest('hex');

  console.log('🔑 Your Monero-Style Keys:');
  console.log('View Private Key:', viewPriv);
  console.log('Spend Private Key:', spendPriv);
  console.log('\\n⚠️  Save these securely! They control your funds.');
}

generateKeys();
"
```

### Running the Application

**Backend (Proof Server):**
```bash
cd backend
npm start
# Server runs on http://localhost:5001
```

**Frontend (React App):**
```bash
cd frontend
npm start
# App runs on http://localhost:3000
```

## 🧪 Complete Flow Example

### 1. Deposit (10 ENA)
```javascript
// User deposits 10 ETH-equivalent into private balance
await contract.privateTransfer(proof, publicSignals, {
  value: ethers.parseEther("10")
});
// Result: EOA balance -10, ENA balance +10 (encrypted)
```

### 2. Transfer (6 ENA to Alice)
```javascript
// Generate stealth address for Alice
const stealthAddr = computeStealthAddress(
  aliceViewPubKey,
  ephemeralPrivKey
);

// Create transfer with encrypted amount
await contract.privateTransfer(proof, publicSignals);
// Result: Stealth payment created, sender's ENA -6
```

### 3. Scan for Payments (Alice)
```javascript
// Alice scans blockchain with her view key
const payments = await scanStealthPayments(aliceViewPrivKey);
console.log('Found payment:', payments[0]);
// Result: Detects incoming 6 ENA payment
```

### 4. Claim Payment (Alice)
```javascript
// Alice generates claim proof with spend key
const claimProof = await generateClaimProof({
  viewPrivateKey: aliceViewPrivKey,
  spendPrivateKey: aliceSpendPrivKey,
  transferAmount: 6,
  stealthAddress: payments[0].stealthAddr
});

await contract.claimStealthPayment(claimProof, publicSignals);
// Result: Alice's ENA balance +6
```

### 5. Withdraw (Alice)
```javascript
// Alice withdraws to her EOA
await contract.privateTransfer(withdrawProof, publicSignals);
// Result: Alice's ENA -6, EOA +6 ETH
```

## 🔧 Technology Stack

### Zero-Knowledge Proofs
- **PLONK** - Universal trusted setup via snarkjs
- **Circom 2.1.8** - Circuit language
- **Transfer Circuit** - ~20k constraints (Phase 6)
- **Claim Circuit** - ~15k constraints (Monero-style)

### Cryptography
- **Poseidon Hash** - ZK-friendly hash function (circomlibjs)
- **BN128 Curve** - Elliptic curve for proofs
- **ECDH** - Shared secret computation for stealth addresses
- **Symmetric Encryption** - Balance commitments

### Backend
- **Node.js + Express** - Proof generation server
- **Helmet.js** - Security headers
- **Rate Limiting** - DoS protection
- **Merkle Tree Manager** - Anonymity set tracking

### Frontend
- **React 18** - Modern UI framework
- **ethers.js v6** - Ethereum interaction
- **MetaMask** - Wallet integration
- **Web3 Context** - Global state management

### Smart Contracts
- **Solidity 0.8.28** - Latest stable version
- **Hardhat** - Development environment
- **PLONK Verifiers** - Auto-generated from circuits
- **Merkle Tree** - On-chain anonymity set

## 🌐 Deployed Contracts (Sepolia Testnet)

### Current Deployment (Phase 6 - Complete)

| Contract | Address | Status |
|----------|---------|--------|
| **Transfer Verifier** | [`0x88E6A90c...B394B`](https://sepolia.etherscan.io/address/0x88E6A90c099809647c5164464f980E8109bB394B) | ✅ Verified |
| **Claim Verifier** | [`0x63Ade6E4...b4C1C`](https://sepolia.etherscan.io/address/0x63Ade6E45c012E336DC1A5297EBaD8a8369b4C1C) | ✅ Verified |
| **Poseidon** | [`0x3b3B814C...265B0`](https://sepolia.etherscan.io/address/0x3b3B814C9D26B3Aad586F6BA326808A0A4d265B0) | ✅ Verified |
| **PrivateTransferV4** | [`0x51cC96fF...14903`](https://sepolia.etherscan.io/address/0x51cC96fFD6cA1B73e18030Aa78A62699F2b14903) | ✅ Verified |

**Deployment Date:** November 27, 2025
**Network:** Sepolia Testnet
**Complete Flow:** ✅ Tested (Deposit → Transfer → Claim → Withdraw)

### On-Chain Verification

**Privacy Enhancement Confirmed:**
- Total deposits: 1 (10 ENA)
- Total stealth payments: **1** (only the 6 ENA transfer)
- Deposits do NOT create stealth payments ✅
- Privacy leak eliminated ✅

## 📊 Circuit Specifications

### Transfer Circuit (Phase 6)
**File:** `circuits/plonk/transfer-phase6.circom`
**Constraints:** ~20,000
**Proof Time:** ~700-800ms

**Public Signals (11 total):**
| Index | Name | Type | Description |
|-------|------|------|-------------|
| [0] | `valid` | Output | Proof validity flag |
| [1] | `newBalance` | Output | Updated sender balance |
| [2] | `newBalanceCommitment` | Output | Poseidon(newBalance, kENA) |
| [3] | `recipientHash` | Output | Poseidon(recipientViewPub, amount) |
| [4] | `nullifier` | Output | Replay protection |
| [5] | `ephemeralPublicKey` | Output | For stealth address derivation |
| [6] | `assetId` | Public Input | Asset identifier |
| [7] | `maxAmount` | Public Input | Range proof upper bound |
| [8] | `balanceCommitment` | Public Input | Original balance commitment |
| [9] | `merkleRoot` | Public Input | Anonymity set root |
| [10] | `encryptedMemo` | Public Input | Private message hash |

### Claim Circuit (Monero-Style)
**File:** `circuits/plonk/claim.circom`
**Constraints:** ~15,000
**Proof Time:** ~35-40s

**Public Signals (5 total):**
| Index | Name | Type | Description |
|-------|------|------|-------------|
| [0] | `valid` | Output | Claim validity |
| [1] | `claimerAddressHash` | Output | Poseidon(viewPub, amount) |
| [2] | `claimedAmount` | Output | Amount being claimed |
| [3] | `assetId` | Output | Asset identifier |
| [4] | `stealthAddress` | Output | Stealth address identifier |

**Key Insight:** The claim circuit proves knowledge of both view key and spend key without revealing them, ensuring only the intended recipient can claim.

## 🔐 Security Features

### Monero-Style Privacy
- **Unlinkability** - Each stealth address is unique, breaking on-chain links
- **View Key Separation** - Can scan without claiming capability
- **Spend Key Protection** - Required for claiming, never revealed on-chain
- **Amount Hiding** - Transfer amounts encrypted, revealed only to recipient

### Zero-Knowledge Proofs
- **Balance Privacy** - Balances committed using Poseidon
- **Amount Privacy** - Transfer amounts hidden in proofs
- **Range Proofs** - Prevents negative balances without revealing amount
- **Merkle Anonymity** - Transfers hidden in anonymity set

### Contract Security
- **Nullifier Tracking** - Prevents double-spending and replay attacks
- **Access Control** - Owner-only admin functions
- **Input Validation** - Strict parameter checking
- **Reentrancy Protection** - Secure external calls

### Infrastructure Security
- **Rate Limiting** - 10 proofs/min, 100 API calls/15min
- **HTTP Security** - Helmet.js with CSP, COEP headers
- **CORS** - Restricted origins
- **Secure Randomness** - crypto.randomBytes(32) for salt

## 📈 Performance Benchmarks

| Metric | Value | Status |
|--------|-------|--------|
| Transfer Proof Generation | ~700-800ms | ✅ Fast |
| Claim Proof Generation | ~35-40s | ⚠️ Acceptable |
| Transfer Circuit Constraints | ~20,000 | ✅ Efficient |
| Claim Circuit Constraints | ~15,000 | ✅ Efficient |
| Gas (Transfer Verification) | ~450-500k | ✅ Reasonable |
| Gas (Claim Verification) | ~400-450k | ✅ Reasonable |
| Merkle Tree Depth | 20 levels | ✅ Large (~1M) |
| Anonymity Set Capacity | ~1M transfers | ✅ Scalable |

## 📁 Project Structure

```
zktoosh/
├── circuits/
│   └── plonk/
│       ├── transfer-phase6.circom    # Main transfer circuit
│       ├── claim.circom              # Monero-style claim circuit
│       ├── stealth.circom            # Stealth address components
│       ├── merkle.circom             # Merkle tree proofs
│       ├── range_proof.circom        # Amount validation
│       └── claim_build/              # Compiled claim circuit
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── plonkProverPhase6.js  # Transfer proof generation
│   │   │   ├── claimProver.js        # Claim proof generation
│   │   │   ├── merkleSync.js         # Merkle tree sync
│   │   │   └── blockchainScanner.js  # Payment scanning
│   │   ├── routes/
│   │   │   ├── proof-phase6.routes.js # Transfer API
│   │   │   ├── claim.routes.js        # Claim API
│   │   │   └── merkle.routes.js       # Merkle tree API
│   │   ├── middleware/
│   │   │   └── rateLimiter.js        # DoS protection
│   │   └── server.js                 # Express server
│   └── package.json
├── contracts/
│   └── plonk/
│       ├── PrivateTransferV4.sol     # Main contract
│       ├── PlonkVerifierPhase6.sol   # Transfer verifier
│       ├── ClaimVerifier.sol         # Claim verifier
│       └── Poseidon.sol              # Hash library
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Phase6Transfer.js     # Transfer UI
│       │   ├── ClaimStealthPayment.js # Claim UI
│       │   ├── DepositPanel.js       # Deposit UI
│       │   └── WithdrawalPanel.js    # Withdraw UI
│       ├── contexts/
│       │   └── Web3Context.jsx       # Web3 state
│       ├── utils/
│       │   └── keyManagement.js      # Dual-key generation
│       └── App.js
├── scripts/
│   ├── deploy-phase6.js              # Deployment script
│   └── verify-contracts.js           # Verification script
├── deployments/                      # Deployment records
├── SESSION_NOTES.md                  # Development log
├── hardhat.config.js
└── README.md
```

## 🎯 Phase 6 Accomplishments

### Core Privacy System ✅
- [x] Monero-style dual-key cryptography
- [x] Stealth address generation
- [x] Ephemeral key exchange (ECDH)
- [x] Payment scanning with view key
- [x] Claim proof with spend key
- [x] Privacy-enhanced deposits

### Advanced Features ✅
- [x] Merkle tree anonymity (20 levels)
- [x] Range proof integration
- [x] Encrypted memo support
- [x] Balance commitment system
- [x] Nullifier-based replay protection
- [x] Admin verifier update functions

### Testing & Deployment ✅
- [x] Complete end-to-end flow tested
- [x] Sepolia testnet deployment
- [x] Contract verification on Etherscan
- [x] On-chain privacy verification
- [x] Backend Merkle tree synchronization
- [x] Frontend dual-key management

### Documentation ✅
- [x] Comprehensive README
- [x] Session notes with technical details
- [x] Circuit specifications
- [x] API documentation
- [x] Deployment records

## 🧪 Testing

### Manual Testing
```bash
# Test complete flow
node test-phase6-flow.js

# Test claim circuit
node test-claim-circuit-final.js

# Scan blockchain for payments
node debug-scan-payments-v2.js

# Check on-chain state
node check-stealth-payment.js
```

### Frontend Testing
1. Open http://localhost:3000
2. Connect MetaMask (Sepolia testnet)
3. Generate Monero-style keys
4. Test flow:
   - Deposit 10 ENA
   - Transfer 6 ENA to another user
   - Scan for incoming payments
   - Claim payment
   - Withdraw to EOA

## 🔮 Future Enhancements

### Phase 7 (Planned)
- [ ] Multi-asset support (ERC20 tokens)
- [ ] Batch transfers (multiple recipients)
- [ ] Subaddresses (single seed, multiple addresses)
- [ ] Transaction history encryption
- [ ] Payment proof generation

### Phase 8 (Research)
- [ ] Ring signatures for sender anonymity
- [ ] Confidential transactions (Bulletproofs)
- [ ] Layer 2 integration (zkRollup)
- [ ] Cross-chain bridges
- [ ] Formal security proofs

### Long-term
- [ ] Mainnet deployment
- [ ] Mobile app (React Native)
- [ ] Hardware wallet support
- [ ] Decentralized key recovery
- [ ] Audit by security firm

## 📖 Key Concepts

### Stealth Addresses
A stealth address is a one-time payment address derived from the recipient's public view key and an ephemeral key pair. Only the recipient can detect and claim payments to their stealth addresses.

**Formula:** `stealthAddr = Poseidon(sharedSecret, recipientViewPub)`

### Dual-Key System
- **View Key**: Used to scan blockchain and detect incoming payments (read-only)
- **Spend Key**: Required to generate claim proofs and access funds (full control)

This separation allows:
- View-only wallets for auditing
- Hot wallet (view key) + cold wallet (spend key) setup
- Delegated scanning without spending capability

### Zero-Knowledge Claims
When claiming a stealth payment, the recipient proves:
1. Knowledge of the view private key
2. Knowledge of the spend private key
3. Correct derivation of the claimer address hash
4. Match with the on-chain encrypted amount

All without revealing any private keys on-chain.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Keep commits atomic and well-described

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 👤 Author

**valtoosh**
- GitHub: [@valtoosh](https://github.com/valtoosh)
- Repository: [zktoosh](https://github.com/valtoosh/zktoosh)

## 🙏 Acknowledgments

- **Monero Project** - Stealth address and dual-key inspiration
- **Circom** - Circuit language ([docs.circom.io](https://docs.circom.io/))
- **snarkjs** - PLONK prover ([github.com/iden3/snarkjs](https://github.com/iden3/snarkjs))
- **circomlibjs** - Poseidon hash ([github.com/iden3/circomlibjs](https://github.com/iden3/circomlibjs))
- **Hardhat** - Smart contract development ([hardhat.org](https://hardhat.org/))
- **Tornado Cash** - Privacy pool design patterns
- **Aztec Protocol** - PLONK implementation insights

## 📞 Support

For issues or questions:
- Open an issue on [GitHub](https://github.com/valtoosh/zktoosh/issues)
- Check [SESSION_NOTES.md](SESSION_NOTES.md) for development history
- Review circuit files in `circuits/plonk/` for technical details

## 🎓 Learn More

### Recommended Reading
- [Monero Stealth Addresses](https://www.getmonero.org/resources/moneropedia/stealthaddress.html)
- [PLONK Paper](https://eprint.iacr.org/2019/953.pdf)
- [Circom Documentation](https://docs.circom.io/)
- [Zero-Knowledge Proofs: An Illustrated Primer](https://blog.cryptographyengineering.com/2014/11/27/zero-knowledge-proofs-illustrated-primer/)

### Video Tutorials
- [Zero-Knowledge Proofs Explained](https://www.youtube.com/watch?v=fOGdb1CTu5c)
- [Circom and snarkjs Tutorial](https://www.youtube.com/watch?v=CTJ1JkYLiyw)

---

**Status:** Phase 6 Complete ✅ | Deployed on Sepolia Testnet
**Latest:** Complete Monero-style privacy flow working end-to-end 🎉
**Repository:** https://github.com/valtoosh/zktoosh

**Privacy Verified On-Chain:** Only 1 stealth payment for 1 transfer (deposits excluded) ✅
