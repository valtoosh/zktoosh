import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './DepositPanel.css';
import PrivateTransferV3Artifact from '../../contracts/plonk/PrivateTransferV3.json';
import contractConfig from '../../contracts/plonk/config.json';

function DepositPanel({ account, signer, onDepositSuccess }) {
  const [amount, setAmount] = useState('0.001');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [balance, setBalance] = useState('0');
  const [loadingBalance, setLoadingBalance] = useState(false);

  const CONTRACT_ADDRESS = contractConfig.transferAddress;

  const fetchBalance = async () => {
    if (!account || !signer) return;

    setLoadingBalance(true);
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        PrivateTransferV3Artifact.abi,
        signer
      );

      const bal = await contract.getBalance(account);
      setBalance(ethers.formatEther(bal));
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [account, signer]);

  const handleDeposit = async () => {
    if (!account) {
      setMessage('❌ Please connect wallet first');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        PrivateTransferV3Artifact.abi,
        signer
      );

      console.log(`Depositing ${amount} ETH...`);
      const tx = await contract.deposit({
        value: ethers.parseEther(amount)
      });

      setMessage('⏳ Transaction submitted... Waiting for confirmation');
      console.log('TX Hash:', tx.hash);

      await tx.wait();

      setMessage('✅ Deposit successful!');
      console.log('✅ Deposit confirmed!');

      // Refresh balance
      await fetchBalance();

      if (onDepositSuccess) {
        onDepositSuccess();
      }

      setTimeout(() => setMessage(''), 5000);

    } catch (error) {
      console.error('Error:', error);
      setMessage(`❌ ${error.message || 'Deposit failed'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="deposit-panel">
      <div className="panel-header">
        <h3>💰 Manage Balance</h3>
        <div className="balance-display">
          {loadingBalance ? (
            <span className="loading-text">Loading...</span>
          ) : (
            <>
              <span className="balance-label">Your Balance:</span>
              <span className="balance-value">{parseFloat(balance).toFixed(4)} ETH</span>
            </>
          )}
        </div>
      </div>

      <p className="deposit-info">
        ℹ️ You must deposit funds to the contract before making private transfers.
        Your balance is stored on-chain but can only be spent using zero-knowledge proofs.
      </p>

      <div className="deposit-controls">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          step="0.001"
          min="0.001"
          placeholder="Amount in ETH"
          disabled={loading}
        />
        <button
          onClick={handleDeposit}
          disabled={loading || !account}
          className="deposit-button"
        >
          {loading ? 'Processing...' : '💸 Deposit ETH'}
        </button>
      </div>

      {message && (
        <div className={`deposit-message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  );
}

export default DepositPanel;
