// frontend/src/components/Phase6Transfer.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { buildPoseidon } from 'circomlibjs';
import './Phase6Transfer.css';
import keyManagement from '../utils/keyManagement';

// Phase 6 contract config
const PHASE6_CONFIG = require('../contracts/plonk/config-phase6.json');
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

const Phase6Transfer = ({ account, provider }) => {
  const [formData, setFormData] = useState({
    recipientViewPublicKey: '', // MONERO-STYLE: Recipient's view public key
    transferAmount: '',
    senderBalance: 0, // Will be fetched from contract
    assetId: 1998, // Whitelisted asset (ENA token)
    maxAmount: 10000,
    vPubIn: 0,
    vPubOut: 0,
    memo: '' // Optional encrypted memo
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [merkleState, setMerkleState] = useState(null);
  const [contractBalance, setContractBalance] = useState('0');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  // MONERO-STYLE: User's own keys
  const [viewPrivateKey, setViewPrivateKey] = useState('');
  const [spendPrivateKey, setSpendPrivateKey] = useState('');
  const [viewPublicKey, setViewPublicKey] = useState('');
  const [keysLoaded, setKeysLoaded] = useState(false);

  // Auto-load or generate keys on mount
  useEffect(() => {
    const initializeKeys = async () => {
      const existingKeys = keyManagement.loadKeys();
      if (existingKeys) {
        setViewPrivateKey(existingKeys.viewPrivateKey);
        setSpendPrivateKey(existingKeys.spendPrivateKey);
        setViewPublicKey(existingKeys.viewPublicKey);
        setKeysLoaded(true);
        console.log('✅ Keys loaded from storage');
      } else {
        // Generate new keys
        console.log('🔑 Generating new Monero-style keys...');
        const newKeys = await keyManagement.generateKeyPair();
        setViewPrivateKey(newKeys.viewPrivateKey);
        setSpendPrivateKey(newKeys.spendPrivateKey);
        setViewPublicKey(newKeys.viewPublicKey);

        // Save to storage
        keyManagement.saveKeys(newKeys.viewPrivateKey, newKeys.spendPrivateKey, newKeys.viewPublicKey);
        setKeysLoaded(true);
        console.log('✅ New keys generated and saved');
      }
    };

    initializeKeys();
  }, []);

  // Fetch contract balance and Merkle state on mount and when account changes
  useEffect(() => {
    if (account) {
      fetchContractBalance();
      fetchMerkleState();
    }
  }, [account]);

  const fetchContractBalance = async () => {
    try {
      // PHASE 6C AUTO-RECOVERY: Query contract for latest transfer to recover state
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        [
          'function balances(address) external view returns (uint256)',
          'function encryptedBalances(address) external view returns (uint256)',
          'event PrivateTransfer(address indexed sender, uint256 nullifier, uint256 stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp, bool valid)'
        ],
        provider
      );

      // First, try to load encrypted balance from localStorage
      let storedEncryptedBalance = localStorage.getItem('zkult_encrypted_balance');
      let storedBalanceCommitment = localStorage.getItem('zkult_balance_commitment');
      let storedSctOld = localStorage.getItem('zkult_sct_old');

      // AUTOMATIC STATE RECOVERY from on-chain events
      if (!storedBalanceCommitment || !storedSctOld) {
        console.log('🔄 AUTOMATIC RECOVERY: Detecting missing state values...');
        console.log('   Missing commitment:', !storedBalanceCommitment);
        console.log('   Missing sct:', !storedSctOld);

        try {
          // Query for user's past PrivateTransfer events
          const filter = contract.filters.PrivateTransfer(account);
          const events = await contract.queryFilter(filter, -10000, 'latest'); // Last ~10k blocks

          if (events.length > 0) {
            console.log(`✅ Found ${events.length} previous transfer(s) on-chain`);
            console.log('⚠️  WARNING: You have previous transfers but missing state values in localStorage');
            console.log('   This means either:');
            console.log('   1. You cleared your browser data');
            console.log('   2. You\'re on a different device');
            console.log('   3. localStorage was corrupted');
            console.log('');
            console.log('📝 SOLUTION:');
            console.log('   Since Phase 6 uses encrypted private state, you have two options:');
            console.log('   1. Make a fresh deposit to reset your encrypted balance');
            console.log('   2. Contact support with your wallet address to recover state');
            console.log('');

            setStatus('⚠️  Previous transfers detected but state values missing. Please deposit fresh ETH or contact support for recovery.');
          } else {
            console.log('ℹ️  No previous transfers found - this appears to be your first transfer');
            console.log('✅ Ready for first transaction');
          }
        } catch (queryError) {
          console.warn('⚠️  Could not query events:', queryError.message);
        }
      } else {
        console.log('✅ State values loaded from localStorage:');
        console.log('   Balance Commitment: ...', storedBalanceCommitment.slice(-20));
        console.log('   SCT Old: ...', storedSctOld.slice(-20));
      }

      // MIGRATION: Check if we need to convert from old scale (1e6) to new scale (1000)
      const conversionVersion = localStorage.getItem('zkult_conversion_version');

      if (storedEncryptedBalance && parseInt(storedEncryptedBalance) > 0) {
        let balanceToUse = parseInt(storedEncryptedBalance);

        // If no version flag, this is old data using 1e6 scale - need to migrate!
        if (!conversionVersion || conversionVersion !== '1000') {
          console.log('🔄 MIGRATION: Converting balance from old scale (1e6) to new scale (1000)');
          console.log('   Old balance:', balanceToUse, 'ENA (1e6 scale)');

          // Convert: oldBalance (1e6 scale) / 1000 = newBalance (1000 scale)
          balanceToUse = Math.floor(balanceToUse / 1000);

          console.log('   New balance:', balanceToUse, 'ENA (1000 scale)');

          // Save migrated value
          localStorage.setItem('zkult_encrypted_balance', balanceToUse.toString());
          localStorage.setItem('zkult_conversion_version', '1000');
        } else {
          console.log('✅ Loaded encrypted balance from storage:', balanceToUse);
        }

        setFormData(prev => ({
          ...prev,
          senderBalance: balanceToUse
        }));
      } else {
        // Fallback: Load from contract's public balance mapping (only for first deposit)
        const balance = await contract.balances(account);
        const balanceInEth = ethers.formatEther(balance);
        setContractBalance(balanceInEth);

        // CONTRACT STANDARD: 1000 ENA = 1 ETH (1 ENA = 0.001 ETH)
        // This matches PrivateTransferV4.sol line 306: depositAmountWei = (vPubDelta * 1 ether) / 1000
        const balanceInENA = Math.floor(parseFloat(balanceInEth) * 1000);
        console.log('📊 Loaded balance from contract:', balanceInENA);
        setFormData(prev => ({
          ...prev,
          senderBalance: balanceInENA
        }));

        // Save initial balance to localStorage with version flag
        localStorage.setItem('zkult_encrypted_balance', balanceInENA.toString());
        localStorage.setItem('zkult_conversion_version', '1000');
      }

      // Always update contract balance display
      const balance = await contract.balances(account);
      const balanceInEth = ethers.formatEther(balance);
      setContractBalance(balanceInEth);

    } catch (error) {
      console.error('Failed to fetch contract balance:', error);
    }
  };

  const fetchMerkleState = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/proof-phase6/merkle-state`);
      const data = await response.json();
      if (data.success) {
        setMerkleState(data.merkleTree);
      }
    } catch (error) {
      console.error('Failed to fetch Merkle state:', error);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert('Please enter a valid deposit amount');
      return;
    }

    setDepositLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        ['function deposit() external payable'],
        signer
      );

      const tx = await contract.deposit({
        value: ethers.parseEther(depositAmount)
      });

      setStatus(`⏳ Depositing ${depositAmount} ETH... TX: ${tx.hash}`);
      await tx.wait();

      // Clear old private state from localStorage
      localStorage.removeItem('zkult_balance_commitment');
      localStorage.removeItem('zkult_sct_old');
      localStorage.removeItem('zkult_kena');
      localStorage.removeItem('zkult_salt');
      localStorage.removeItem('zkult_encrypted_balance'); // Clear old balance

      setStatus(`✅ Deposited ${depositAmount} ETH successfully! State has been reset.`);
      setDepositAmount('');

      // Refresh balance and save to localStorage
      await fetchContractBalance();

      // After deposit, reset encrypted balance tracking
      console.log('💾 Resetting encrypted balance after deposit');
    } catch (error) {
      console.error('Deposit failed:', error);
      setStatus(`❌ Deposit failed: ${error.message}`);
    } finally {
      setDepositLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`[DEBUG] handleInputChange: name=${name}, value=${value}`);
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const generatePhase6Proof = async () => {
    setLoading(true);
    setStatus('🔐 Generating Phase 6 PLONK proof...');
    setResult(null);

    try {
      // Step 1: Generate proof with Phase 6 features
      setStatus('⚙️  Generating proof with stealth address, Merkle tree, range proofs...');

      // CRITICAL: Load stored state values from localStorage
      // These are needed to prove the old balance commitment exists in the Merkle tree
      const storedCommitment = localStorage.getItem('zkult_balance_commitment');
      const storedSct = localStorage.getItem('zkult_sct_old');
      const storedKENA = localStorage.getItem('zkult_kena');
      const storedSalt = localStorage.getItem('zkult_salt');

      // DEBUG: Log current localStorage state
      console.log('=== Current State Before Transfer ===');
      console.log('Balance Commitment:', localStorage.getItem('zkult_balance_commitment'));
      console.log('Encrypted Balance:', localStorage.getItem('zkult_encrypted_balance'));
      console.log('kENA:', localStorage.getItem('zkult_kena'));
      console.log('SCT Old:', localStorage.getItem('zkult_sct_old'));
      console.log('Salt:', localStorage.getItem('zkult_salt'));
      console.log('===================================');

      // CRITICAL FIX: Auto-derive view public key from private key input
      // Users often paste their VIEW PRIVATE KEY instead of VIEW PUBLIC KEY
      // We need to hash it first to get the public key: viewPubKey = Poseidon(viewPrivKey)
      let recipientViewPubKey = formData.recipientViewPublicKey;

      // Check if the input looks like a private key vs already-hashed public key
      // Poseidon output (public key) is typically 76-78 digits
      // Private keys can be any length but are usually stored differently
      // For safety: Only auto-derive if it's clearly NOT a Poseidon hash output
      if (recipientViewPubKey && recipientViewPubKey.length > 0 && !recipientViewPubKey.startsWith('0x')) {
        // Check if it's a typical Poseidon hash output (76-78 digits)
        const isProbablyPoseidonOutput = recipientViewPubKey.length >= 76 && recipientViewPubKey.length <= 78;

        if (isProbablyPoseidonOutput) {
          console.log('✅ Input appears to be a Poseidon hash (view public key), using as-is');
          console.log('   Length:', recipientViewPubKey.length, 'digits');
        } else {
          console.log('🔧 Input does NOT look like a Poseidon hash, attempting auto-derivation...');
          console.log('   Length:', recipientViewPubKey.length, 'digits (expected 76-78 for public key)');
          try {
            // Initialize Poseidon hash function
            const poseidon = await buildPoseidon();

            // Hash the input to derive the public key
            const derived = poseidon.F.toString(poseidon([BigInt(recipientViewPubKey)]));
            console.log('✅ Derived view public key:', derived);
            console.log('   Original input:', recipientViewPubKey);

            recipientViewPubKey = derived;
          } catch (error) {
            console.warn('⚠️  Could not auto-derive, using input as-is:', error.message);
            // If derivation fails, use the original value
          }
        }
      } else {
        console.log('✅ Using provided view public key as-is:', recipientViewPubKey);
      }

      // PHASE 6 PRIVATE TRANSFERS: vPubIn should ALWAYS be 0 after initial deposit
      // Only deposit (vPubIn > 0) if there's NO encrypted balance on-chain
      //
      // CRITICAL: For privacy, private transfers must have value=0 in the transaction!
      // Only the FIRST deposit should send ETH (vPubIn > 0)
      //
      // Check if user explicitly entered vPubIn (for deposits), otherwise 0
      let autoVPubIn = parseInt(formData.vPubIn) || 0;
      let adjustedSenderBalance = parseInt(formData.senderBalance);

      // Fetch on-chain encrypted balance to determine if this is truly first transfer
      let onChainSct = null;
      try {
        onChainSct = await contract.encryptedBalances(walletAddress);
        console.log('🔍 On-chain encrypted balance (sct):', onChainSct.toString());
      } catch (error) {
        console.warn('Could not fetch on-chain sct:', error.message);
      }

      // Only auto-convert if:
      // 1. No localStorage state (!storedSct)
      // 2. No on-chain state (onChainSct === 0 or null)
      // 3. User has a balance to deposit
      // 4. User didn't manually set vPubIn
      const hasOnChainBalance = onChainSct && onChainSct.toString() !== '0';
      const isFirstTransferWithBalance = !storedSct && !hasOnChainBalance && parseInt(formData.senderBalance) > 0;

      if (isFirstTransferWithBalance && autoVPubIn === 0) {
        autoVPubIn = parseInt(formData.senderBalance);
        adjustedSenderBalance = 0; // ENA balance starts at 0, EOA balance goes into vPubIn
        console.log('🔄 AUTO-CONVERT: vPubIn =', autoVPubIn, ', senderBalance (ENA) = 0 (first deposit)');
      } else if (hasOnChainBalance) {
        console.log('✅ Detected on-chain encrypted balance → Private transfer mode (vPubIn = 0)');
        autoVPubIn = 0; // Force vPubIn = 0 for private transfers
      }

      const proofRequest = {
        senderBalance: adjustedSenderBalance,
        transferAmount: parseInt(formData.transferAmount),
        recipientViewPublicKey: recipientViewPubKey, // MONERO-STYLE (auto-derived if needed)
        assetId: parseInt(formData.assetId),
        maxAmount: parseInt(formData.maxAmount),
        vPubIn: autoVPubIn,
        vPubOut: parseInt(formData.vPubOut) || 0,
        // Phase 6C: Send stored Merkle commitment values for proof generation
        // Backend will use these to prove old commitment exists in tree
        balanceCommitment: storedCommitment || undefined,  // OLD commitment in Merkle tree
        sctOld: storedSct || undefined,  // OLD encrypted state
        kENA: storedKENA || undefined,  // Encryption key for ENA balance (CRITICAL for sct verification)
        salt: storedSalt || undefined,
        // Phase 6E: Encrypted memo (optional)
        encryptedMemo: formData.memo ? [
          ethers.keccak256(ethers.toUtf8Bytes(formData.memo)).slice(0, 66),
          ethers.keccak256(ethers.toUtf8Bytes(formData.memo + '_2')).slice(0, 66)
        ] : undefined
      };

      console.log('📤 Sending Phase 6 proof request:', proofRequest);

      const proofResponse = await fetch(`${BACKEND_URL}/api/proof-phase6/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proofRequest)
      });

      if (!proofResponse.ok) {
        const errorData = await proofResponse.json();
        throw new Error(errorData.message || 'Proof generation failed');
      }

      const proofData = await proofResponse.json();
      console.log('Full proof data from backend:', proofData);
      console.log('✅ Proof generated:', proofData);

      setStatus(`✅ Proof generated in ${proofData.generationTime}ms`);

      // Step 2: Format proof for contract
      setStatus('📝 Formatting proof for contract...');

      const formatResponse = await fetch(`${BACKEND_URL}/api/proof-phase6/format-for-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: proofData.proof,
          publicSignals: proofData.publicSignals
        })
      });

      if (!formatResponse.ok) {
        throw new Error('Proof formatting failed');
      }

      const { proofBytes, publicSignals } = await formatResponse.json();

      setStatus('✅ Proof formatted for contract');

      // Step 3: Submit to contract
      setStatus('📡 Submitting to PrivateTransferV4 contract...');

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        [
          'function privateTransfer(uint256[24] proof, uint256[17] publicSignals, bytes32 encryptedMemo) external payable',
          'event TransferInitiated(address indexed sender, uint256 stealthAddress, uint256 ephemeralPublicKey, uint256 timestamp)',
          'event StealthPaymentCreated(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo)'
        ],
        signer
      );

      // Prepare encrypted memo bytes32
      const memoBytes32 = formData.memo
        ? ethers.keccak256(ethers.toUtf8Bytes(formData.memo))
        : ethers.ZeroHash;

      // Calculate ETH to send: vPubIn (EOA → ENA deposit)
      // Contract formula: depositAmountWei = (vPubIn * 1 ether) / 1000
      // So: 1000 ENA = 1 ETH, therefore 5 ENA = 0.005 ETH
      // IMPORTANT: Use proofRequest.vPubIn (includes auto-convert), NOT formData.vPubIn!
      const vPubInToSend = proofRequest.vPubIn || 0;
      const ethToSend = vPubInToSend > 0
        ? (BigInt(vPubInToSend) * ethers.parseEther('1')) / BigInt(1000)
        : BigInt(0);
      console.log('💸 Sending ETH with transaction:', ethers.formatEther(ethToSend), 'ETH (', ethToSend.toString(), 'wei) for vPubIn:', vPubInToSend, 'ENA');

      const tx = await contract.privateTransfer(
        proofBytes,
        publicSignals,
        memoBytes32,
        { value: ethToSend }
      );

      setStatus(`⏳ Waiting for confirmation... TX: ${tx.hash}`);
      const receipt = await tx.wait();

      setStatus('✅ Transaction confirmed!');

      // Extract Phase 6 specific data
      const resultData = {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        etherscanUrl: `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`,

        // Phase 6B: Stealth address data
        stealthAddress: proofData.stealthAddress,
        ephemeralPublicKey: proofData.ephemeralPublicKey,
        stealthSalt: proofData.stealthSalt, // CRITICAL for claiming!

        // Transfer details for claiming
        transferAmount: formData.transferAmount,
        assetId: formData.assetId,

        // Phase 6C: Merkle data
        merkleLeaf: proofData.merkleLeaf,
        merkleProofValid: proofData.merkleProofValid,

        // Phase 6E: Encrypted memo
        encryptedMemoHash: proofData.encryptedMemoHash,

        // Other data
        newBalance: proofData.newBalance,
        nullifier: proofData.nullifier,
        generationTime: proofData.generationTime
      };

      setResult(resultData);

      // CRITICAL: Update encrypted balance and state in localStorage
      const newBalance = parseInt(proofData.newBalance);
      console.log('💾 Updating encrypted balance:', newBalance);
      localStorage.setItem('zkult_encrypted_balance', newBalance.toString());

      // Also save the new balance commitment, sctNew, and kENA for next transfer
      if (proofData.newBalanceCommitment) {
        localStorage.setItem('zkult_balance_commitment', proofData.newBalanceCommitment);
        console.log('💾 Saved balance commitment for next transfer');
      }
      if (proofData.sctNew) {
        localStorage.setItem('zkult_sct_old', proofData.sctNew);
        console.log('💾 Saved sctNew as sctOld for next transfer');
      }
      if (proofData.kENA) {
        localStorage.setItem('zkult_kena', proofData.kENA);
        console.log('💾 Saved kENA for next transfer (CRITICAL for sct verification)');
      }
      if (proofData.salt) {
        localStorage.setItem('zkult_salt', proofData.salt);
        console.log('💾 Saved salt for next transfer');
      }

      // Update form data with new balance
      setFormData(prev => ({
        ...prev,
        senderBalance: newBalance
      }));

      // Refresh Merkle state
      await fetchMerkleState();

    } catch (error) {
      console.error('❌ Error:', error);
      setStatus(`❌ Error: ${error.message}`);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Optional: Show a temporary "Copied!" message
      console.log('Copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="phase6-container">
      <div className="phase6-header">
        <div className="phase6-title">
          <h2>🔒 Phase 6: Maximum Privacy Transfer</h2>
        </div>
        <p className="phase6-subtitle">
          Experience military-grade privacy with Stealth Addresses, Merkle Anonymity Sets, Range Proofs, and Encrypted Memos — all powered by PLONK zero-knowledge proofs.
        </p>
        <div className="phase6-badges">
          <span className="phase6-badge">⚡ PLONK</span>
          <span className="phase6-badge purple">🎭 Stealth</span>
          <span className="phase6-badge green">🌳 Merkle</span>
          <span className="phase6-badge orange">📊 Range</span>
        </div>
      </div>

      {/* Monero-Style Keys Panel */}
      <div className="keys-panel" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        color: 'white'
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>🔑 Your Monero-Style Keys</h3>
        {keysLoaded ? (
          <div>
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '5px' }}>
                <strong>View Public Key</strong> (Share this to receive payments)
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '10px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                wordBreak: 'break-all',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ flex: 1 }}>{viewPublicKey}</span>
                <button
                  onClick={() => copyToClipboard(viewPublicKey)}
                  style={{
                    background: 'rgba(255,255,255,0.3)',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '12px'
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div>
            <div style={{ fontSize: '13px', opacity: 0.8 }}>
              ✅ Keys loaded and ready • Stored securely in browser
            </div>
          </div>
        ) : (
          <div>🔄 Generating keys...</div>
        )}
      </div>

      {/* Deposit Panel */}
      <div className="deposit-panel">
        <h3>💰 Deposit ETH to Contract</h3>
        <div className="deposit-info">
          <div className="balance-display">
            <span className="balance-label">Your Contract Balance:</span>
            <span className="balance-value">{contractBalance} ETH</span>
            <span className="balance-hint">({formData.senderBalance} ENA tokens)</span>
          </div>
        </div>
        <div className="deposit-form">
          <input
            type="number"
            step="0.001"
            placeholder="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            disabled={depositLoading || !account}
            className="deposit-input"
          />
          <button
            className="deposit-button"
            onClick={handleDeposit}
            disabled={depositLoading || !account || !depositAmount}
          >
            {depositLoading ? '⏳ Depositing...' : '💸 Deposit ETH'}
          </button>
        </div>
        <div className="deposit-hint">
          💡 <strong>Simple Conversion:</strong> 0.001 ETH = 1 ENA  |  0.01 ETH = 10 ENA  |  0.1 ETH = 100 ENA  |  1 ETH = 1,000 ENA
        </div>
      </div>

      {merkleState && (
        <div className="anonymity-panel">
          <h3>🌳 Anonymity Set Status</h3>
          <div className="anonymity-grid">
            <div className="anonymity-stat">
              <div className="anonymity-stat-label">Current Size</div>
              <div className="anonymity-stat-value">
                <strong>{merkleState.size}</strong> users
              </div>
            </div>
            <div className="anonymity-stat">
              <div className="anonymity-stat-label">Capacity</div>
              <div className="anonymity-stat-value">1,048,576</div>
              <div className="anonymity-stat-hint">(2^20 maximum)</div>
            </div>
            <div className="anonymity-stat">
              <div className="anonymity-stat-label">Privacy Level</div>
              <div className="anonymity-stat-value">
                <strong>1</strong> of <strong>{merkleState.size || 1}</strong>
              </div>
              <div className="anonymity-stat-hint">in anonymity set</div>
            </div>
          </div>
        </div>
      )}

      <div className="phase6-form-section">
        <h3>📝 Transfer Details</h3>
        <div className="phase6-form-grid">
          <div className="phase6-form-group">
            <label>🎯 Recipient View Public Key</label>
            <input
              type="text"
              name="recipientViewPublicKey"
              value={formData.recipientViewPublicKey}
              onChange={handleInputChange}
              placeholder="Recipient's view public key (Monero-style address)"
              disabled={loading}
            />
            <span className="phase6-field-hint">
              🎭 Will be converted to stealth address (Phase 6B)
            </span>
          </div>

          <div className="phase6-form-group">
            <label>💰 Transfer Amount</label>
            <input
              type="number"
              name="transferAmount"
              value={formData.transferAmount}
              onChange={handleInputChange}
              placeholder="100"
              disabled={loading}
            />
            <span className="phase6-field-hint">
              📊 Amount hidden via range proof (Phase 6D)
            </span>
          </div>

          <div className="phase6-form-group">
            <label>💳 Current Balance (ENA)</label>
            <input
              type="number"
              name="senderBalance"
              value={formData.senderBalance}
              onChange={handleInputChange}
              disabled={true}
            />
            <span className="phase6-field-hint">
              🔗 Auto-fetched from contract ({contractBalance} ETH deposited)
            </span>
          </div>

          <div className="phase6-form-group">
            <label>📈 Max Amount</label>
            <input
              type="number"
              name="maxAmount"
              value={formData.maxAmount}
              onChange={handleInputChange}
              disabled={loading}
            />
            <span className="phase6-field-hint">
              Range proof upper bound
            </span>
          </div>

          <div className="phase6-form-group">
            <label>🏷️ Asset ID</label>
            <input
              type="number"
              name="assetId"
              value={formData.assetId}
              onChange={handleInputChange}
              disabled={loading}
            />
            <span className="phase6-field-hint">
              Asset identifier (1998 = ENA token, whitelisted)
            </span>
          </div>

          <div className="phase6-form-group full-width">
            <label>📝 Encrypted Memo (Optional - Phase 6E)</label>
            <input
              type="text"
              name="memo"
              value={formData.memo}
              onChange={handleInputChange}
              placeholder="Invoice #123 - Product purchase"
              disabled={loading}
            />
            <span className="phase6-field-hint">
              🔐 Encrypted on-chain for auditor access only
            </span>
          </div>
        </div>
      </div>

      <button
        className="phase6-submit-button"
        onClick={generatePhase6Proof}
        disabled={loading || !account || !formData.recipientViewPublicKey || !formData.transferAmount}
      >
        {loading ? (<><span className="phase6-loading">⏳</span> Generating Proof...</>) : ('🚀 Generate Phase 6 Proof & Transfer')}
      </button>

      {status && (
        <div className={`phase6-status ${result?.success ? 'success' : result?.error ? 'error' : ''}`}>
          {status}
        </div>
      )}

      {result && result.success && (
        <div className="phase6-result-panel">
          <h3>✅ Phase 6 Transfer Complete!</h3>

          {/* Critical Claiming Parameters Warning Box */}
          <div style={{
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
            border: '2px solid #ff8c00',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(255, 107, 53, 0.3)'
          }}>
            <h4 style={{ color: '#fff', marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>
              ⚠️ IMPORTANT: Share These Parameters with Recipient
            </h4>
            <p style={{ color: '#fff', fontSize: '14px', marginBottom: '16px' }}>
              The recipient needs these values to claim the payment using ZK proof. Share via secure channel (encrypted messaging, QR code, etc.)
            </p>

            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: '#fff' }}>Stealth Address:</strong>
                <button
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => copyToClipboard(result.stealthAddress)}
                >
                  📋 Copy
                </button>
              </div>
              <code style={{ color: '#ffe0b3', wordBreak: 'break-all', display: 'block' }}>{result.stealthAddress}</code>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: '#fff' }}>Stealth Salt (CRITICAL!):</strong>
                <button
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => copyToClipboard(result.stealthSalt)}
                >
                  📋 Copy
                </button>
              </div>
              <code style={{ color: '#ffe0b3', wordBreak: 'break-all', display: 'block' }}>{result.stealthSalt}</code>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: '#fff' }}>Transfer Amount:</strong>
                <button
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => copyToClipboard(result.transferAmount)}
                >
                  📋 Copy
                </button>
              </div>
              <code style={{ color: '#ffe0b3', wordBreak: 'break-all', display: 'block' }}>{result.transferAmount} ENA</code>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: '#fff' }}>Ephemeral Public Key:</strong>
                <button
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => copyToClipboard(result.ephemeralPublicKey)}
                >
                  📋 Copy
                </button>
              </div>
              <code style={{ color: '#ffe0b3', wordBreak: 'break-all', display: 'block' }}>{result.ephemeralPublicKey}</code>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: '#fff' }}>Asset ID:</strong>
                <button
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => copyToClipboard(result.assetId.toString())}
                >
                  📋 Copy
                </button>
              </div>
              <code style={{ color: '#ffe0b3', wordBreak: 'break-all', display: 'block' }}>{result.assetId}</code>
            </div>
          </div>

          <div className="phase6-result-section">
            <h4>🎭 Phase 6B: Stealth Address</h4>
            <div className="phase6-result-item">
              <label>Stealth Address:</label>
              <div className="phase6-copyable-value">
                <code>{result.stealthAddress?.slice(0, 20)}...{result.stealthAddress?.slice(-10)}</code>
                <button className="phase6-copy-button" onClick={() => copyToClipboard(result.stealthAddress)}>📋</button>
              </div>
              <span className="phase6-field-hint">
                🎯 One-time address - recipient uses this to claim
              </span>
            </div>

            <div className="phase6-result-item">
              <label>Ephemeral Public Key:</label>
              <div className="phase6-copyable-value">
                <code>{result.ephemeralPublicKey?.slice(0, 20)}...{result.ephemeralPublicKey?.slice(-10)}</code>
                <button className="phase6-copy-button" onClick={() => copyToClipboard(result.ephemeralPublicKey)}>📋</button>
              </div>
              <span className="phase6-field-hint">
                📤 Needed for ZK claiming proof generation
              </span>
            </div>

            <div className="phase6-result-item">
              <label>Stealth Salt:</label>
              <div className="phase6-copyable-value">
                <code>{result.stealthSalt?.slice(0, 20)}...{result.stealthSalt?.slice(-10)}</code>
                <button className="phase6-copy-button" onClick={() => copyToClipboard(result.stealthSalt)}>📋</button>
              </div>
              <span className="phase6-field-hint">
                🔑 CRITICAL: Required for claiming with ZK proof
              </span>
            </div>
          </div>

          <div className="phase6-result-section">
            <h4>🌳 Phase 6C: Merkle Anonymity</h4>
            <div className="phase6-result-item">
              <label>Merkle Leaf:</label>
              <code>{result.merkleLeaf?.slice(0, 30)}...</code>
            </div>
            <div className="phase6-result-item">
              <label>Proof Valid:</label>
              <code>{result.merkleProofValid === '1' ? '✅ Yes' : '❌ No'}</code>
            </div>
          </div>

          {result.encryptedMemoHash && result.encryptedMemoHash !== '0' && (
            <div className="phase6-result-section">
              <h4>📝 Phase 6E: Encrypted Memo</h4>
              <div className="phase6-result-item">
                <label>Memo Hash:</label>
                <code>{result.encryptedMemoHash.slice(0, 30)}...</code>
              </div>
              <span className="phase6-field-hint">
                🔐 Memo encrypted on-chain for auditors
              </span>
            </div>
          )}

          <div className="phase6-result-section">
            <h4>📊 Transaction Details</h4>
            <div className="phase6-result-item">
              <label>Transaction Hash:</label>
              <a href={result.etherscanUrl} target="_blank" rel="noopener noreferrer" className="phase6-result-link">
                {result.txHash?.slice(0, 20)}...{result.txHash?.slice(-10)}
              </a>
            </div>
            <div className="phase6-result-item">
              <label>Block Number:</label>
              <code>{result.blockNumber}</code>
            </div>
            <div className="phase6-result-item">
              <label>Gas Used:</label>
              <code>{result.gasUsed}</code>
            </div>
            <div className="phase6-result-item">
              <label>New Balance:</label>
              <code>{result.newBalance}</code>
            </div>
            <div className="phase6-result-item">
              <label>Proof Generation Time:</label>
              <code>{result.generationTime}ms</code>
            </div>
          </div>

          <div className="phase6-privacy-summary">
            <h4>🔒 Privacy Summary</h4>
            <ul className="phase6-privacy-list">
              <li><span>✅</span><span><strong>Recipient hidden</strong> via stealth address (Phase 6B)</span></li>
              <li><span>✅</span><span><strong>Sender hidden</strong> among {merkleState?.size || 1} users (Phase 6C)</span></li>
              <li><span>✅</span><span><strong>Amount hidden</strong> via range proof (Phase 6D)</span></li>
              <li><span>✅</span><span><strong>Balance hidden</strong> via ZK proof</span></li>
              {result.encryptedMemoHash && result.encryptedMemoHash !== '0' && (
                <li><span>✅</span><span><strong>Memo encrypted</strong> for auditors only (Phase 6E)</span></li>
              )}
            </ul>
          </div>
        </div>
      )}

      {result && !result.success && (
        <div className="phase6-error-panel">
          <h3>❌ Transfer Failed</h3>
          <p>{result.error}</p>
        </div>
      )}
    </div>
  );
};

export default Phase6Transfer;
