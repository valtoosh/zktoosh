// frontend/src/components/ClaimStealthPayment.js
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './ClaimStealthPayment.css';
import keyManagement from '../utils/keyManagement';

const PHASE6_CONFIG = require('../contracts/plonk/config-phase6.json');
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

const ClaimStealthPayment = ({ account, provider }) => {
  const [stealthAddress, setStealthAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [allPayments, setAllPayments] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawRecipient, setWithdrawRecipient] = useState('');
  const [userBalance, setUserBalance] = useState('0');

  // MONERO-STYLE: View and spend keys for claiming
  const [viewPrivateKey, setViewPrivateKey] = useState('');
  const [spendPrivateKey, setSpendPrivateKey] = useState('');
  const [viewPublicKey, setViewPublicKey] = useState('');
  
  // For manual claiming
  const [transferAmount, setTransferAmount] = useState('');
  const [stealthSalt, setStealthSalt] = useState('');
  const [assetId, setAssetId] = useState('1998');

  // Auto-load keys
  useEffect(() => {
    const keys = keyManagement.loadKeys();
    if (keys) {
      setViewPrivateKey(keys.viewPrivateKey);
      setSpendPrivateKey(keys.spendPrivateKey);
      setViewPublicKey(keys.viewPublicKey);
      setStatus('✅ Keys loaded from storage');
    } else {
      setStatus('⚠️  No keys found. Generate keys first in the Transfer tab.');
    }
  }, []);

  // --- 1. CHECK PAYMENT (Single) ---
  const checkPayment = async () => {
    if (!stealthAddress) {
      alert('Please enter a stealth address');
      return;
    }

    setLoading(true);
    setStatus('🔍 Checking stealth payment...');

    try {
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        [
          'function getStealthPayment(uint256 index) external view returns (uint256 stealthAddr, uint256[2] ephemeralPubKey, bytes32 memo, uint256 timestamp, bool claimed)',
          'function stealthPayments(uint256) external view returns (uint256 stealthAddress, uint256[2] ephemeralPublicKey, uint256 encryptedAmount, uint256 timestamp, bytes32 encryptedMemo, bool claimed)'
        ],
        provider
      );

      // We use the mapping getter. Note: Struct returns tuple.
      // ephemeralPublicKey is uint256[2]
      const payment = await contract.stealthPayments(stealthAddress);

      if (payment.timestamp.toString() === '0') {
        setStatus('❌ No payment found for this stealth address');
        setPaymentInfo(null);
      } else {
        // Format the key nicely
        const ephKey = [payment.ephemeralPublicKey[0].toString(), payment.ephemeralPublicKey[1].toString()];
        
        setPaymentInfo({
          stealthAddress: payment.stealthAddress.toString(),
          ephemeralPublicKey: ephKey, // Store as Array [x, y]
          timestamp: new Date(Number(payment.timestamp) * 1000).toLocaleString(),
          encryptedMemo: payment.encryptedMemo,
          claimed: payment.claimed
        });
        setStatus(payment.claimed ? '✅ Payment found (already claimed)' : '✅ Payment found (unclaimed)');
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. SCAN ALL PAYMENTS ---
  const scanAllPayments = async () => {
    if (!provider) {
      alert('Please connect your wallet');
      return;
    }
  
    setScanning(true);
    setStatus('🔍 Scanning blockchain for stealth payments...');
  
    try {
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        [
          // Updated Event Signature for ECDH (uint256[2])
          'event StealthPaymentCreated(uint256 indexed stealthAddress, uint256[2] ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp)'
        ],
        provider
      );
  
      console.log('🔍 Scanning for StealthPaymentCreated events...');
  
      const filter = contract.filters.StealthPaymentCreated();
      const events = await contract.queryFilter(filter, 0, 'latest'); // In prod, limit range
  
      console.log(`Found ${events.length} stealth payment event(s)`);
  
      const payments = events.map((event, index) => {
        // event.args.ephemeralPublicKey is a Proxy/Array of BigInts
        const ephKey = [
            event.args.ephemeralPublicKey[0].toString(),
            event.args.ephemeralPublicKey[1].toString()
        ];

        return {
            index,
            stealthAddress: event.args.stealthAddress.toString(),
            ephemeralPublicKey: ephKey,
            encryptedMemo: event.args.encryptedMemo,
            timestamp: new Date(Number(event.args.timestamp) * 1000).toLocaleString(),
            blockNumber: event.blockNumber,
            txHash: event.transactionHash,
            claimed: false // Note: Events don't tell us if it's claimed later. Need to check state.
        };
      });
  
      setAllPayments(payments);
  
      if (payments.length === 0) {
        setStatus('❌ No stealth payments found on this contract');
      } else {
        setStatus(`✅ Found ${payments.length} stealth payment(s) to scan`);
      }
    } catch (error) {
      console.error('Error scanning payments:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setScanning(false);
    }
  };

  // --- 3. CLAIM PAYMENT ---
  const claimPaymentWithZKProof = async () => {
    if (!paymentInfo || paymentInfo.claimed) {
      alert('No unclaimed payment to claim');
      return;
    }
    if (!transferAmount || !stealthSalt) {
      alert('Please enter the transfer amount and stealth salt');
      return;
    }
    if (!viewPrivateKey || !spendPrivateKey) {
      alert('No keys found.');
      return;
    }

    setLoading(true);
    setStatus('🔐 Generating Monero-style ZK claiming proof (ECDH)...');

    try {
      console.log('📨 Sending claim proof request...');
      console.log('   Stealth Address:', stealthAddress);
      console.log('   Ephemeral Key:', paymentInfo.ephemeralPublicKey); // Should be [x, y]

      const proofResponse = await fetch(`${BACKEND_URL}/api/claim/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewPrivateKey: viewPrivateKey,
          spendPrivateKey: spendPrivateKey,
          transferAmount: transferAmount,
          stealthSalt: stealthSalt,
          ephemeralPublicKey: paymentInfo.ephemeralPublicKey, // Sends Array [x, y]
          assetId: assetId,
          stealthAddress: stealthAddress
        })
      });

      if (!proofResponse.ok) {
        const err = await proofResponse.json();
        throw new Error(err.message || `Proof generation failed: ${proofResponse.statusText}`);
      }

      const proofData = await proofResponse.json();
      if (!proofData.success) throw new Error(proofData.error);

      console.log('✅ Claim proof generated successfully');

      // Format for contract
      setStatus('📝 Formatting proof for contract...');
      const formatResponse = await fetch(`${BACKEND_URL}/api/claim/format-for-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: proofData.proof,
          publicSignals: proofData.publicSignals
        })
      });

      if (!formatResponse.ok) throw new Error('Proof formatting failed');
      const formattedData = await formatResponse.json();

      console.log('✅ Proof formatted. Submitting transaction...');
      setStatus('📡 Submitting claim to blockchain...');

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        ['function claimStealthPayment(uint256[24] calldata proof, uint256[5] calldata publicSignals) external'],
        signer
      );

      const tx = await contract.claimStealthPayment(formattedData.proof, formattedData.publicSignals);
      setStatus(`⏳ Waiting for confirmation... TX: ${tx.hash}`);

      await tx.wait();
      setStatus(`✅ Payment claimed successfully! TX: ${tx.hash}`);

      setPaymentInfo(prev => ({ ...prev, claimed: true }));
      await fetchUserBalance();
      setTransferAmount('');
      setStealthSalt('');

    } catch (error) {
      console.error('❌ Claim error:', error);
      setStatus(`❌ Claim failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBalance = async () => {
    if (!account || !provider) return;
    try {
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        ['function balances(address) external view returns (uint256)'],
        provider
      );
      const balance = await contract.balances(account);
      setUserBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('❌ Error fetching balance:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Enter valid amount');
      return;
    }
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        ['function withdraw(uint256, address payable) external'],
        signer
      );
      const tx = await contract.withdraw(ethers.parseEther(withdrawAmount), withdrawRecipient || account);
      await tx.wait();
      setStatus(`✅ Withdrawal successful!`);
      setWithdrawAmount('');
      await fetchUserBalance();
    } catch (error) {
      setStatus(`❌ Withdrawal failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUserBalance();
  }, [account, provider]);

  return (
    <div className="claim-container">
      <div className="claim-header">
        <h2>🎁 Claim Stealth Payment</h2>
        <p className="claim-subtitle">ECDH Privacy Enabled</p>
      </div>

      <div className="claim-section">
        <h3>🔍 Check Payment</h3>
        <div className="claim-input-group">
          <input
            type="text"
            placeholder="Enter stealth address"
            value={stealthAddress}
            onChange={(e) => setStealthAddress(e.target.value)}
            disabled={loading}
            className="claim-input"
          />
          <button onClick={checkPayment} disabled={loading || !account} className="claim-button primary">
            {loading ? '⏳ Checking...' : '🔍 Check Payment'}
          </button>
        </div>
      </div>

      <div className="claim-section">
        <h3>🌐 Scan All Payments</h3>
        <button onClick={scanAllPayments} disabled={scanning || !account} className="claim-button secondary">
          {scanning ? '⏳ Scanning...' : '🔍 Scan Blockchain'}
        </button>
      </div>

      {status && <div className="claim-status">{status}</div>}

      {paymentInfo && (
        <div className="payment-info-panel">
          <h3>📋 Payment Details</h3>
          <div className="payment-info-grid">
            <div className="payment-info-item">
              <label>Stealth Address:</label>
              <code>{paymentInfo.stealthAddress.slice(0, 15)}...</code>
            </div>
            <div className="payment-info-item">
              <label>Ephemeral Key:</label>
              <code>{JSON.stringify(paymentInfo.ephemeralPublicKey).slice(0, 20)}...</code>
            </div>
            <div className="payment-info-item">
              <label>Status:</label>
              <code>{paymentInfo.claimed ? '✅ Claimed' : '🎁 Unclaimed'}</code>
            </div>
          </div>

          {!paymentInfo.claimed && (
            <div style={{ marginTop: '20px' }}>
              <h4>Claiming Parameters</h4>
              <input
                type="number"
                placeholder="Transfer Amount"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="claim-input"
              />
              <input
                type="text"
                placeholder="Stealth Salt"
                value={stealthSalt}
                onChange={(e) => setStealthSalt(e.target.value)}
                className="claim-input"
              />
              <button onClick={claimPaymentWithZKProof} disabled={loading} className="claim-button claim-action">
                🔐 Claim with ZK Proof
              </button>
            </div>
          )}
        </div>
      )}

      {allPayments.length > 0 && (
        <div className="all-payments-panel">
          <h3>📜 All Stealth Payments</h3>
          <div className="payments-list">
            {allPayments.map((payment) => (
              <div key={payment.index} className="payment-card">
                <span>#{payment.index} - {payment.stealthAddress.slice(0,10)}...</span>
                <button className="claim-button small" onClick={() => {
                    setStealthAddress(payment.stealthAddress);
                    setPaymentInfo({
                        stealthAddress: payment.stealthAddress,
                        ephemeralPublicKey: payment.ephemeralPublicKey,
                        timestamp: payment.timestamp,
                        encryptedMemo: payment.encryptedMemo,
                        claimed: payment.claimed
                    });
                }}>Select</button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="claim-section">
        <h3>💰 Withdraw ETH</h3>
        <p className="claim-subtitle">Your Balance: <strong>{userBalance} ETH</strong></p>
        <div className="claim-input-group">
          <input
            type="number"
            placeholder="Amount to withdraw (ETH)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            disabled={loading}
            className="claim-input"
            step="0.001"
            min="0"
          />
          <input
            type="text"
            placeholder="Recipient address (leave blank to use your address)"
            value={withdrawRecipient}
            onChange={(e) => setWithdrawRecipient(e.target.value)}
            disabled={loading}
            className="claim-input"
          />
          <button onClick={handleWithdraw} disabled={loading} className="claim-button primary">
            {loading ? '⏳ Withdrawing...' : '💸 Withdraw ETH'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimStealthPayment;