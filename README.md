# zkUlt - Zero-Knowledge Private Transfer System

**Privacy-preserving blockchain transfer system using PLONK proofs with Ethereum address support and nullifier-based replay protection.**

[![Phase 5B](https://img.shields.io/badge/Phase%205B-Complete-brightgreen)]() [![Sepolia](https://img.shields.io/badge/Sepolia-Deployed-blue)]() [![PLONK](https://img.shields.io/badge/ZK-PLONK-purple)]()

## 🌟 Features

- ✅ **Dual Account Model** - EOA (public) + ENA (encrypted private) balances (Phase 5A)
- ✅ **Function Privacy** - Unified privateTransfer() for deposits, transfers, withdrawals (Phase 5B)
- ✅ **Enhanced PLONK Circuit** - 11 public signals with encrypted balance tracking
- ✅ **Ethereum Address Support** - Recipients as 160-bit hashed addresses
- ✅ **Nullifier System** - Prevents replay attacks and double-spending (Phase 4)
- ✅ **Hash-Based Claiming** - Recipients claim transfers privately
- ✅ **Field Arithmetic Withdrawals** - Detects negative vPubDelta via wraparound
- ✅ **Poseidon Encryption** - Symmetric encryption for ENA balances
- ✅ **API Rate Limiting** - DoS protection (Phase 4)
- ✅ **Privacy-Preserving** - Transfer amounts and balances remain private
- ✅ **Fast Proof Generation** - ~1.2-1.8s per proof
- ✅ **Sepolia Deployment** - Verified contracts on testnet

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Frontend  │─────▶│   Backend    │─────▶│  Smart Contract │
│   (React)   │      │  (Express)   │      │   (Sepolia)     │
└─────────────┘      └──────────────┘      └─────────────────┘
      │                     │                       │
      │                     ▼                       │
      │            ┌──────────────┐                 │
      │            │ PLONK Prover │                 │
      │            │  (snarkjs)   │                 │
      │            └──────────────┘                 │
      │                     │                       │
      └─────────────────────┴───────────────────────┘
                         Circom Circuit
             (transfer.circom - 3,297 constraints, 8 signals)
```

## 🚀 Quick Start

### Prerequisites
- Node.js v20.x
- npm or yarn
- Git
- MetaMask (for frontend)

### Installation
```bash
# Clone repository
git clone https://github.com/valtoosh/zkult.git
cd zkult

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

**Backend:**
```bash
cd backend
npm start
# Server runs on http://localhost:5001
```

**Frontend:**
```bash
cd frontend
npm start
# App runs on http://localhost:3000
```

### Testing Phase 4 Nullifier System
```bash
# Test replay attack prevention
node test-phase4-nullifier.js
```

## 🔧 Technology Stack

- **Zero-Knowledge Proofs:** PLONK (via snarkjs)
- **Circuit Language:** Circom 2.1.8
- **Backend:** Node.js + Express + Helmet.js
- **Frontend:** React 18 + ethers.js v6
- **Smart Contracts:** Solidity 0.8.28 + Hardhat
- **Blockchain:** Ethereum Sepolia Testnet
- **Hash Function:** Poseidon (circomlibjs)
- **Security:** Rate limiting (express-rate-limit)

## 🌐 Deployed Contracts (Sepolia)

| Contract | Address | Status |
|----------|---------|--------|
| **PlonkVerifier** | [`0x3E6815...9ADF`](https://sepolia.etherscan.io/address/0x3E6815d062519E5f6cA3cf5b0aa5c9e860bc9ADF) | ✅ Verified (Phase 5B - Latest) |
| **PrivateTransferV3** | [`0xE4D1Df...dB14`](https://sepolia.etherscan.io/address/0xE4D1Df4A4Fca4c26ecA611521D7CB1420fA6dB14) | ✅ Verified (Phase 5B - Wei Fix) |

**Previous Deployments:**
| Contract | Address | Status | Issue |
|----------|---------|--------|-------|
| PrivateTransferV3 (v2) | [`0x7f36ED...D41b1`](https://sepolia.etherscan.io/address/0x7f36ED306efc5a526dc6074491B3C015488D41b1) | ⚠️ Deprecated | Wei conversion bug |
| PrivateTransferV3 (v1) | [`0xb224C9...ecd3`](https://sepolia.etherscan.io/address/0xb224C992C6B3E22982d2B9E8fd12d3e38639ecd3) | ⚠️ Deprecated | Claiming placeholder bug |

## 📊 Project Status

### **Phase 5B: ✅ COMPLETE - Function Privacy (Unified zkTransfer)** 🎉
- ✅ Unified privateTransfer() function for all operations
- ✅ Field arithmetic for withdrawal detection
- ✅ Pending transfer creation for claiming
- ✅ Complete end-to-end flow tested: Deposit → Transfer → Claim → Withdraw
- ✅ Contract deployed and verified on Sepolia
- ✅ Frontend fully integrated
- ✅ Documentation complete ([PHASE5_COMPLETE.md](PHASE5_COMPLETE.md))

### **Phase 5A: ✅ COMPLETE - Dual Account Model**
- ✅ EOA (public) and ENA (encrypted private) balance tracking
- ✅ Poseidon symmetric encryption for ENA balances
- ✅ Circuit enhanced to 11 public signals
- ✅ Frontend dual balance display with localStorage persistence
- ✅ kENA generation and management

### **Phase 4: ✅ COMPLETE - Critical Security Hardening**
- ✅ Nullifier system for replay attack prevention
- ✅ Secure random salt generation (32 bytes)
- ✅ API rate limiting (10 proofs/min, 100 API calls/15min)
- ✅ HTTP security headers (Helmet.js)

### **Phase 3: ✅ COMPLETE - Hash-Based Claiming**
- ✅ Recipient privacy via Poseidon hash
- ✅ Two-phase transfer (create → claim)
- ✅ Deposit/withdrawal management
- ✅ Frontend UI with claiming interface

### **Phase 2: ✅ COMPLETE - Frontend & Deployment**
- ✅ React frontend with MetaMask integration
- ✅ Contract deployment to Sepolia
- ✅ End-to-end testing
- ✅ Professional UI (Binance-inspired)

### **Phase 1: ✅ COMPLETE - Core System**
- ✅ Enhanced PLONK circuit with commitments
- ✅ Backend proof generation
- ✅ API endpoints
- ✅ Test suite

### **Phase 6: 📅 NEXT - Advanced Features**
- [ ] Auditability (two-recipient encryption)
- [ ] Range proofs for amount validation
- [ ] Merkle trees for privacy pools
- [ ] Multi-asset support (ERC20)

## 📁 Project Structure
```
zkult/
├── circuits/
│   └── plonk/
│       ├── transfer.circom          # Enhanced PLONK circuit (8 signals)
│       └── output/                  # Compiled circuit artifacts
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   └── plonkProver.js      # Proof generation + secure salt
│   │   ├── routes/
│   │   │   └── proof.routes.js     # API endpoints
│   │   ├── middleware/
│   │   │   └── rateLimiter.js      # Rate limiting (Phase 4)
│   │   └── server.js               # Express server + Helmet
│   └── keys/plonk/                 # PLONK keys (gitignored)
├── contracts/
│   └── plonk/
│       ├── PlonkVerifier.sol       # Auto-generated verifier (8 signals)
│       └── PrivateTransferV3.sol   # Transfer contract + nullifiers
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── TransactionForm.js  # Send transfer UI
│       │   ├── ClaimTransfer.js    # Claim transfer UI
│       │   ├── DepositPanel.js     # Deposit management
│       │   └── WithdrawalPanel.js  # Withdrawal management
│       ├── contexts/
│       │   └── Web3Context.jsx     # Web3/MetaMask integration
│       └── App.js
├── deployments/                    # Deployment records
├── test-phase4-nullifier.js        # Nullifier replay test
├── PHASE4_COMPLETE.md              # Phase 4 documentation
└── README.md
```

## 🧪 Circuit Specifications

### Public Signals (8 total - Phase 4)
| Index | Name | Type | Description |
|-------|------|------|-------------|
| [0] | `valid` | Output | Transfer validation result |
| [1] | `newBalance` | Output | Sender's balance after transfer |
| [2] | `newBalanceCommitment` | Output | Poseidon commitment to new balance |
| [3] | `recipientHash` | Output | Hash for recipient claiming |
| [4] | **`nullifier`** | Output | **Unique ID to prevent double-spending (Phase 4)** |
| [5] | `assetId` | Public Input | Asset identifier |
| [6] | `maxAmount` | Public Input | Maximum allowed amount |
| [7] | `balanceCommitment` | Public Input | Commitment to original balance |

**Nullifier Formula:** `nullifier = Poseidon(balanceCommitment, salt, transferAmount)`

## 🔐 Security Features

### Phase 4 Enhancements
- **🛡️ Nullifier System:** Prevents replay attacks and double-spending
  - Each proof generates unique nullifier
  - Contract tracks used nullifiers
  - Replay attacks automatically rejected

- **🎲 Secure Randomness:** Cryptographically secure salt generation
  - `crypto.randomBytes(32)` for 256-bit entropy
  - Field-constrained to BN128 curve
  - Unique proof per transaction

- **⏱️ Rate Limiting:** Three-tier DoS protection
  - Proof generation: 10 requests/min per IP
  - General API: 100 requests/15min per IP
  - Strict limiter: 5 requests/min for sensitive ops

- **🔒 HTTP Security:** Helmet.js security headers
  - CSP, COEP, and other security policies
  - Protection against common web vulnerabilities

### Core Privacy Features
- **Private Balances:** Balance commitments using Poseidon hash
- **Private Recipients:** Ethereum addresses hashed to 160-bit values
- **Private Amounts:** Transfer amounts hidden in zero-knowledge proof
- **Public Verification:** Anyone can verify proof validity without seeing private data
- **Hash-Based Claiming:** Recipients claim without revealing address on-chain

## 📈 Performance

| Metric | Value | Status |
|--------|-------|--------|
| Proof Generation | ~1-1.5s | ✅ Good |
| Circuit Constraints | 3,297 | ✅ Reasonable |
| Public Signals | 8 | ✅ Optimized |
| Gas (Proof Verification) | ~400k-450k | ✅ Acceptable |
| Proving Key Size | ~6MB | ✅ Acceptable |
| Address Validation | Regex (fast) | ✅ Efficient |

## 🔗 Comparison to Azeroth Paper

**Feature Parity: ~85%** | **Security Maturity: ~70%**

| Feature | Azeroth | zkUlt (Phase 4) | Status |
|---------|---------|-----------------|--------|
| Zero-knowledge proofs | ✅ Groth16 | ✅ PLONK | ✅ **BETTER** (universal setup) |
| Balance privacy | ✅ Pedersen | ✅ Poseidon | ✅ **BETTER** (ZK-friendly) |
| Replay protection | ✅ Nullifiers | ✅ Nullifiers | ✅ **EQUAL** |
| Secure randomness | ✅ Secure | ✅ crypto.randomBytes(32) | ✅ **EQUAL** |
| DoS protection | ✅ Rate limiting | ✅ Express rate-limit | ✅ **EQUAL** |
| Auditability | ✅ Two-recipient | ❌ Not implemented | 🔴 **Phase 5** |
| Formal proofs | ✅ L-IND, TR-NM, BAL, AUD | ❌ Not implemented | 🔴 **Phase 5** |

## 🛣️ Roadmap

**Completed (Phases 1-4):**
- ✅ Core PLONK system
- ✅ Frontend integration
- ✅ Hash-based claiming
- ✅ Nullifier system
- ✅ Secure randomness
- ✅ Rate limiting
- ✅ Sepolia deployment

**Phase 5 (Documentation & Research):**
- [ ] Technical documentation
- [ ] Research paper/report
- [ ] Performance benchmarks vs. existing systems
- [ ] Security analysis (informal security arguments)
- [ ] Demo video
- [ ] arXiv/blog post

**Phase 6 (Testing & Hardening):**
- [ ] Comprehensive test suite
- [ ] Input validation hardening
- [ ] Gas optimization
- [ ] Load testing

**Long-term:**
- [ ] Auditability (two-recipient encryption)
- [ ] Formal security proofs
- [ ] Multi-asset support (ERC20)
- [ ] Privacy pools (Merkle trees)
- [ ] Mainnet deployment

## 🧪 Example Usage

### Send Transfer
```javascript
// Test input
const input = {
  senderBalance: 6000,
  transferAmount: 200,
  recipientAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  assetId: 1998,
  maxAmount: 12000
};

// Expected output
{
  valid: true,
  newBalance: 5800,  // 6000 - 200
  nullifier: '686030640708880201...',  // Phase 4
  recipientHash: '720737295108221033...',
  proof: { ... },
  generationTime: 1332  // ms
}
```

### Claim Transfer
```javascript
// Recipient claims using recipientHash
const recipientHash = '720737295108221033...';
await contract.claimTransfer(recipientHash);
// Funds credited to recipient's balance
```

## 🤝 Contributing

Contributions welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 👤 Author

**valtoosh**
- GitHub: [@valtoosh](https://github.com/valtoosh)

## 🙏 Acknowledgments

- [Circom](https://docs.circom.io/) - Circuit language
- [snarkjs](https://github.com/iden3/snarkjs) - PLONK prover
- [circomlibjs](https://github.com/iden3/circomlibjs) - Poseidon hash
- [Hardhat](https://hardhat.org/) - Smart contract development
- [Azeroth Paper](https://eprint.iacr.org/2023/xxx) - Research inspiration

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Check [PHASE4_COMPLETE.md](./PHASE4_COMPLETE.md) for detailed Phase 4 documentation

---

**Status:** Phase 5B Complete (Dual Account Model + Function Privacy) | Deployed on Sepolia Testnet

**Latest:** Complete end-to-end flow tested successfully: Deposit → Transfer → Claim → Withdraw 🎉
