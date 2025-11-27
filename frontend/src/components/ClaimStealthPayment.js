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
  const [detectedPayments, setDetectedPayments] = useState([]);

  // For manual claiming (when auto-detection doesn't work)
  const [transferAmount, setTransferAmount] = useState('');
  const [stealthSalt, setStealthSalt] = useState('');
  const [assetId, setAssetId] = useState('1998'); // Default to ENA

  // Auto-load keys from storage on mount
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
          'function stealthPayments(uint256) external view returns (uint256 stealthAddress, uint256 ephemeralPublicKey, uint256 timestamp, bytes32 encryptedMemo, bool claimed)',
          'function isStealthAddressUnclaimed(uint256) external view returns (bool)'
        ],
        provider
      );

      const payment = await contract.stealthPayments(stealthAddress);
      const isUnclaimed = await contract.isStealthAddressUnclaimed(stealthAddress);

      if (payment.timestamp.toString() === '0') {
        setStatus('❌ No payment found for this stealth address');
        setPaymentInfo(null);
      } else {
        setPaymentInfo({
          stealthAddress: payment.stealthAddress.toString(),
          ephemeralPublicKey: payment.ephemeralPublicKey.toString(),
          timestamp: new Date(Number(payment.timestamp) * 1000).toLocaleString(),
          encryptedMemo: payment.encryptedMemo,
          claimed: payment.claimed,
          isUnclaimed
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
          'event StealthPaymentCreated(uint256 indexed stealthAddress, uint256 ephemeralPublicKey, bytes32 encryptedMemo, uint256 timestamp)'
        ],
        provider
      );
  
      console.log('🔍 Scanning for StealthPaymentCreated events...');
  
      const filter = contract.filters.StealthPaymentCreated();
      const events = await contract.queryFilter(filter, 0, 'latest');
  
      console.log(`Found ${events.length} stealth payment event(s)`);
  
      const payments = events.map((event, index) => ({
        index,
        stealthAddress: event.args.stealthAddress.toString(),
        ephemeralPublicKey: event.args.ephemeralPublicKey.toString(),
        encryptedMemo: event.args.encryptedMemo,
        timestamp: new Date(Number(event.args.timestamp) * 1000).toLocaleString(),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        claimed: false  // We'll check this separately if needed
      }));
  
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

  const claimPaymentWithZKProof = async () => {
    // Validate inputs
    if (!paymentInfo || paymentInfo.claimed) {
      alert('No unclaimed payment to claim');
      return;
    }

    if (!transferAmount || !stealthSalt) {
      alert('Please enter the transfer amount and stealth salt (received from sender)');
      return;
    }

    if (!viewPrivateKey || !spendPrivateKey) {
      alert('No keys found. Please generate keys first in the Transfer tab.');
      return;
    }

    setLoading(true);
    setStatus('🔐 Generating Monero-style ZK claiming proof...');

    try {
      // Step 1: Generate ZK proof via backend (MONERO-STYLE)
      console.log('📨 Sending Monero-style claim proof request to backend...');
      console.log('   Stealth Address:', stealthAddress);
      console.log('   Transfer Amount:', transferAmount);
      console.log('   Asset ID:', assetId);

      const proofResponse = await fetch(`${BACKEND_URL}/api/claim/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewPrivateKey: viewPrivateKey,              // MONERO-STYLE
          spendPrivateKey: spendPrivateKey,            // MONERO-STYLE
          transferAmount: transferAmount,
          stealthSalt: stealthSalt,
          ephemeralPublicKey: paymentInfo.ephemeralPublicKey,
          assetId: assetId,
          stealthAddress: stealthAddress
        })
      });

      if (!proofResponse.ok) {
        throw new Error(`Proof generation failed: ${proofResponse.statusText}`);
      }

      const proofData = await proofResponse.json();

      if (!proofData.success) {
        throw new Error(proofData.error || 'Proof generation failed');
      }

      console.log('✅ Claim proof generated successfully');

      // Step 2: Format proof for contract
      setStatus('📝 Formatting proof for contract...');

      const formatResponse = await fetch(`${BACKEND_URL}/api/claim/format-for-contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: proofData.proof,
          publicSignals: proofData.publicSignals
        })
      });

      if (!formatResponse.ok) {
        throw new Error(`Proof formatting failed: ${formatResponse.statusText}`);
      }

      const formattedData = await formatResponse.json();

      if (!formattedData.success) {
        throw new Error(formattedData.error || 'Proof formatting failed');
      }

      console.log('✅ Proof formatted for contract');
      console.log('   Proof elements:', formattedData.proof.length);
      console.log('   Public signals:', formattedData.publicSignals.length);

      // Step 4: Submit claim with ZK proof
      setStatus('📡 Submitting claim with ZK proof...');

      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        ['function claimStealthPayment(uint256[24] calldata proof, uint256[5] calldata publicSignals) external'],
        signer
      );

      const tx = await contract.claimStealthPayment(formattedData.proof, formattedData.publicSignals);
      setStatus(`⏳ Waiting for confirmation... TX: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`✅ Payment claimed successfully! Funds credited to your balance.\n🔗 TX: ${tx.hash}`);

      // Update payment info
      setPaymentInfo(prev => ({ ...prev, claimed: true }));

      // Refresh balance after claiming
      await fetchUserBalance();

      // Clear sensitive inputs
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
      console.log('📊 Balance fetched from contract:', balance.toString(), 'wei');
      console.log('📊 Balance in ETH:', ethers.formatEther(balance));
      setUserBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('❌ Error fetching balance:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Please enter a valid withdrawal amount');
      return;
    }

    const recipient = withdrawRecipient || account;
    if (!recipient) {
      alert('Please enter a recipient address');
      return;
    }

    setLoading(true);
    setStatus('💸 Processing withdrawal...');

    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PHASE6_CONFIG.transferAddress,
        ['function withdraw(uint256, address payable) external'],
        signer
      );

      const amountInWei = ethers.parseEther(withdrawAmount);
      const tx = await contract.withdraw(amountInWei, recipient);
      setStatus(`⏳ Waiting for confirmation... TX: ${tx.hash}`);

      const receipt = await tx.wait();
      setStatus(`✅ Withdrawal successful! Sent ${withdrawAmount} ETH to ${recipient}`);

      // Clear form and refresh balance
      setWithdrawAmount('');
      setWithdrawRecipient('');
      await fetchUserBalance();
    } catch (error) {
      console.error('Error withdrawing:', error);
      setStatus(`❌ Withdrawal failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user balance on mount
  React.useEffect(() => {
    fetchUserBalance();
  }, [account, provider]);

  return (
    <div className="claim-container">
      <div className="claim-header">
        <h2>🎁 Claim Stealth Payment</h2>
        <p className="claim-subtitle">
          Enter the stealth address you received to check and claim your payment
        </p>
      </div>

      <div className="claim-section">
        <h3>🔍 Check Payment</h3>
        <div className="claim-input-group">
          <input
            type="text"
            placeholder="Enter stealth address (e.g., 12345...)"
            value={stealthAddress}
            onChange={(e) => setStealthAddress(e.target.value)}
            disabled={loading}
            className="claim-input"
          />
          <button
            onClick={checkPayment}
            disabled={loading || !account}
            className="claim-button primary"
          >
            {loading ? '⏳ Checking...' : '🔍 Check Payment'}
          </button>
        </div>
      </div>

      <div className="claim-section">
        <h3>🌐 Scan All Payments</h3>
        <p className="claim-hint">
          Scan the blockchain for all stealth payments (this may take a moment)
        </p>
        <button
          onClick={scanAllPayments}
          disabled={scanning || !account}
          className="claim-button secondary"
        >
          {scanning ? '⏳ Scanning...' : '🔍 Scan Blockchain'}
        </button>
      </div>

      {status && (
        <div className={`claim-status ${status.includes('❌') ? 'error' : status.includes('✅') ? 'success' : ''}`}>
          {status}
        </div>
      )}

      {paymentInfo && (
        <div className="payment-info-panel">
          <h3>📋 Payment Details</h3>
          <div className="payment-info-grid">
            <div className="payment-info-item">
              <label>Stealth Address:</label>
              <code>{paymentInfo.stealthAddress.slice(0, 20)}...{paymentInfo.stealthAddress.slice(-10)}</code>
            </div>
            <div className="payment-info-item">
              <label>Ephemeral Public Key:</label>
              <code>{paymentInfo.ephemeralPublicKey.slice(0, 20)}...{paymentInfo.ephemeralPublicKey.slice(-10)}</code>
            </div>
            <div className="payment-info-item">
              <label>Timestamp:</label>
              <code>{paymentInfo.timestamp}</code>
            </div>
            <div className="payment-info-item">
              <label>Status:</label>
              <code className={paymentInfo.claimed ? 'claimed' : 'unclaimed'}>
                {paymentInfo.claimed ? '✅ Claimed' : '🎁 Unclaimed'}
              </code>
            </div>
          </div>

          {!paymentInfo.claimed && (
            <div style={{ marginTop: '20px' }}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <p style={{ color: '#3b82f6', fontSize: '14px', margin: 0 }}>
                  🔐 <strong>ZK Claiming Proof Required</strong>
                </p>
                <p style={{ color: '#a0aec0', fontSize: '13px', margin: '8px 0 0 0' }}>
                  To claim this payment with fund transfer, you need the transfer amount and stealth salt. The sender should have shared these with you off-chain (e.g., via encrypted messaging).
                </p>
              </div>

              <h4 style={{ color: '#f3f4f6', marginBottom: '12px' }}>Claiming Parameters (from sender)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <input
                  type="number"
                  placeholder="Transfer Amount (e.g., 500 for 500 ENA)"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  disabled={loading}
                  className="claim-input"
                />
                <input
                  type="text"
                  placeholder="Stealth Salt (big number from sender)"
                  value={stealthSalt}
                  onChange={(e) => setStealthSalt(e.target.value)}
                  disabled={loading}
                  className="claim-input"
                />
                <input
                  type="number"
                  placeholder="Asset ID (default: 1998 for ENA)"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  disabled={loading}
                  className="claim-input"
                />
              </div>

              <button
                onClick={claimPaymentWithZKProof}
                disabled={loading || !transferAmount || !stealthSalt}
                className="claim-button claim-action"
              >
                {loading ? '⏳ Claiming...' : '🔐 Claim with ZK Proof'}
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
              <div key={payment.index} className={`payment-card ${payment.claimed ? 'claimed' : 'unclaimed'}`}>
                <div className="payment-card-header">
                  <span className="payment-index">#{payment.index}</span>
                  <span className={`payment-status ${payment.claimed ? 'claimed' : 'unclaimed'}`}>
                    {payment.claimed ? '✅ Claimed' : '🎁 Unclaimed'}
                  </span>
                </div>
                <div className="payment-card-body">
                  <div className="payment-card-item">
                    <label>Stealth Address:</label>
                    <code>{payment.stealthAddress.slice(0, 15)}...{payment.stealthAddress.slice(-8)}</code>
                  </div>
                  <div className="payment-card-item">
                    <label>Time:</label>
                    <span>{payment.timestamp}</span>
                  </div>
                  {!payment.claimed && (
                    <button
                      onClick={() => {
                        setStealthAddress(payment.stealthAddress);
                        setPaymentInfo({
                          stealthAddress: payment.stealthAddress,
                          ephemeralPublicKey: payment.ephemeralPublicKey,
                          timestamp: payment.timestamp,
                          encryptedMemo: payment.encryptedMemo,
                          claimed: payment.claimed,
                          isUnclaimed: true
                        });
                      }}
                      className="claim-button small"
                    >
                      Select to Claim
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="claim-section" style={{ marginTop: '30px', background: 'linear-gradient(135deg, #1a2332 0%, #1f2937 100%)' }}>
        <h3>💰 Withdraw ETH</h3>
        <p className="claim-hint">
          Your Balance: <strong>{userBalance} ETH</strong>
        </p>
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px'
        }}>
          <p style={{ color: '#22c55e', fontSize: '14px', margin: 0 }}>
            ✅ <strong>ZK Claiming Enabled:</strong> When you claim a stealth payment with ZK proof, funds are automatically credited to your withdrawable balance.
          </p>
          <p style={{ color: '#a0aec0', fontSize: '13px', margin: '8px 0 0 0' }}>
            Your balance includes both deposited ETH and claimed stealth payments. You can withdraw anytime.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            placeholder="Amount to withdraw (ETH)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            disabled={loading}
            className="claim-input"
          />
          <input
            type="text"
            placeholder="Recipient address (leave blank to use your address)"
            value={withdrawRecipient}
            onChange={(e) => setWithdrawRecipient(e.target.value)}
            disabled={loading}
            className="claim-input"
          />
          <button
            onClick={handleWithdraw}
            disabled={loading || !account}
            className="claim-button claim-action"
          >
            {loading ? '⏳ Withdrawing...' : '💸 Withdraw ETH'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClaimStealthPayment;
