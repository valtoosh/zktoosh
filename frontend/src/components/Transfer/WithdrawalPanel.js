import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './WithdrawalPanel.css';
import PrivateTransferV3Artifact from '../../contracts/plonk/PrivateTransferV3.json';
import contractConfig from '../../contracts/plonk/config.json';

function WithdrawalPanel({ account, signer, onWithdrawSuccess }) {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
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
    // Auto-fill recipient with connected account
    if (account) {
      setRecipient(account);
    }
  }, [account, signer]);

  const handleWithdraw = async () => {
    if (!account) {
      setMessage('❌ Please connect wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setMessage('❌ Please enter a valid amount');
      return;
    }

    if (!recipient || !ethers.isAddress(recipient)) {
      setMessage('❌ Please enter a valid recipient address');
      return;
    }

    const withdrawAmount = ethers.parseEther(amount);
    const contractBalance = ethers.parseEther(balance);

    if (withdrawAmount > contractBalance) {
      setMessage('❌ Insufficient balance in contract');
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

      console.log(`Withdrawing ${amount} ETH to ${recipient}...`);

      // Estimate gas first
      setMessage('⏳ Estimating gas...');
      try {
        const gasEstimate = await contract.withdraw.estimateGas(withdrawAmount, recipient);
        console.log('⛽ Gas estimate:', gasEstimate.toString());
      } catch (gasError) {
        console.error('❌ Gas estimation failed:', gasError);
        throw new Error('Transaction would revert. Please check your balance.');
      }

      setMessage('⏳ Sending withdrawal transaction...');

      const tx = await contract.withdraw(withdrawAmount, recipient, {
        gasLimit: 200000
      });

      setMessage('⏳ Transaction submitted... Waiting for confirmation');
      console.log('TX Hash:', tx.hash);

      const receipt = await tx.wait();

      setMessage('✅ Withdrawal successful!');
      console.log('✅ Withdrawal confirmed!');

      // Refresh balance
      await fetchBalance();

      if (onWithdrawSuccess) {
        onWithdrawSuccess({
          success: true,
          proofValid: true,
          amount,
          recipient,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          etherscanUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`,
          onChain: true,
          time: 'N/A',
          privacy: false,
          assetId: 'ETH'
        });
      }

      // Clear form
      setAmount('');

      setTimeout(() => setMessage(''), 5000);

    } catch (error) {
      console.error('Error:', error);
      let errorMessage = error.message || 'Withdrawal failed';
      if (error.reason) {
        errorMessage = error.reason;
      }
      setMessage(`❌ ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="withdrawal-panel">
      <div className="panel-header">
        <h3>💸 Withdraw Funds</h3>
        <div className="balance-display">
          {loadingBalance ? (
            <span className="loading-text">Loading...</span>
          ) : (
            <>
              <span className="balance-label">Available Balance:</span>
              <span className="balance-value">{parseFloat(balance).toFixed(4)} ETH</span>
            </>
          )}
        </div>
      </div>

      <p className="withdrawal-info">
        ℹ️ Withdraw your claimed funds from the contract to your wallet.
        You can withdraw to any Ethereum address or receive directly to your connected wallet.
      </p>

      <div className="form-group">
        <label htmlFor="amount">
          Withdrawal Amount (ETH)
          <span className="label-hint">Available: {parseFloat(balance).toFixed(4)} ETH</span>
        </label>
        <input
          type="number"
          id="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          step="0.0001"
          min="0.0001"
          max={balance}
          placeholder="Amount to withdraw"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="recipient">
          Recipient Address
          <span className="label-hint">Defaults to your connected wallet</span>
        </label>
        <input
          type="text"
          id="recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          disabled={loading}
        />
      </div>

      <button
        onClick={handleWithdraw}
        disabled={loading || !account || parseFloat(balance) === 0}
        className="withdrawal-button"
      >
        {loading ? (
          <>
            <span className="spinner"></span>
            Processing...
          </>
        ) : (
          '💰 Withdraw to Wallet'
        )}
      </button>

      {message && (
        <div className={`withdrawal-message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {parseFloat(balance) === 0 && !loadingBalance && (
        <div className="empty-balance-notice">
          <p>💡 Your contract balance is empty.</p>
          <p>You need to either:</p>
          <ul>
            <li>Claim a pending transfer (if you're a recipient)</li>
            <li>Deposit funds (if you want to make transfers)</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default WithdrawalPanel;
