// frontend/src/App.js
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Web3Provider, useWeb3 } from './contexts/Web3Context';
import WalletConnect from './components/WalletConnect';
import Phase6Transfer from './components/Phase6Transfer'; // PHASE 6
import ClaimStealthPayment from './components/ClaimStealthPayment'; // PHASE 6 Claiming
import StatusPanel from './components/StatusPanel';
import Logo from './components/Common/Logo';
import './App.css';

function AppContent() {
  const [proofSystem] = useState('plonk'); // PLONK-only for now
  const [activeTab, setActiveTab] = useState('phase6'); // Default to Phase 6
  const { account } = useWeb3();

  return (
    <div className="App">
        {/* Header */}
        <header className="app-header">
          <div className="logo-section">
            <Logo size={50} />
            <div className="brand-text">
              <h1>zkUlt</h1>
              <span className="subtitle">Privacy-Preserving Transfers</span>
            </div>
          </div>
          <div className="header-right">
            <div className="proof-badge">
              <span className="badge plonk">PLONK Phase 6</span>
            </div>
            <WalletConnect />
          </div>
        </header>

        {/* Main Content */}
        <main className="app-main">
          <div className="container">
            {/* Info Banner */}
            <div className="info-banner">
              <div className="banner-icon">ℹ️</div>
              <div className="banner-content">
                <h3>Maximum Privacy with PLONK Phase 6</h3>
                <p>
                  zkUlt Phase 6 combines Monero-style stealth addresses, Merkle tree anonymity,
                  range proofs, and encrypted memos for ultimate transaction privacy.
                </p>
              </div>
            </div>

            {/* Status Panel */}
            <StatusPanel proofSystem={proofSystem} />

            {/* Tab Navigation */}
            <div className="tab-navigation">
              <button
                className={`tab-button ${activeTab === 'phase6' ? 'active' : ''}`}
                onClick={() => setActiveTab('phase6')}
              >
                📤 Send Transfer
              </button>
              <button
                className={`tab-button ${activeTab === 'claim-stealth' ? 'active' : ''}`}
                onClick={() => setActiveTab('claim-stealth')}
              >
                🎁 Claim Payment
              </button>
            </div>

            {/* Phase 6 Transfer or Claim */}
            <div className="transfer-section">
              {activeTab === 'phase6' ? (
                <Phase6Transfer
                  account={account}
                  provider={window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null}
                />
              ) : (
                <ClaimStealthPayment
                  account={account}
                  provider={window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null}
                />
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-links">
            <a href="https://github.com/valtoosh/zkult" target="_blank" rel="noopener noreferrer">
              📚 GitHub
            </a>
            <a href="https://docs.zkult.dev" target="_blank" rel="noopener noreferrer">
              📖 Docs
            </a>
            <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer">
              🔍 Explorer
            </a>
          </div>
          <p className="footer-text">
            Built with ❤️ using PLONK • No Trusted Setup • Universal Composability
          </p>
        </footer>
      </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}

export default App;