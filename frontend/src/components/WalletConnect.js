// frontend/src/components/WalletConnect.js
import React from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import './WalletConnect.css';

const WalletConnect = () => {
  const { account, balance, isConnected, error, connectWallet, disconnectWallet } = useWeb3();

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance) => {
    return parseFloat(balance).toFixed(4);
  };

  return (
    <div className="wallet-connect">
      {error && (
        <div className="wallet-error">
          {error}
        </div>
      )}
      
      {!isConnected ? (
        <button 
          className="connect-button"
          onClick={connectWallet}
        >
          🦊 Connect Wallet
        </button>
      ) : (
        <div className="wallet-info">
          <div className="wallet-details">
            <span className="wallet-address" title={account}>
              {formatAddress(account)}
            </span>
            <span className="wallet-balance">
              {formatBalance(balance)} ETH
            </span>
          </div>
          <button 
            className="disconnect-button"
            onClick={disconnectWallet}
            title="Disconnect"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;