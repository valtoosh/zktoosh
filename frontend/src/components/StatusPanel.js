// frontend/src/components/StatusPanel.js
import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import './StatusPanel.css';

const StatusPanel = ({ proofSystem }) => {
  const { account, chainId, isConnected } = useWeb3();
  const [serverStatus, setServerStatus] = useState('checking');
  const [serverInfo, setServerInfo] = useState(null);

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkServerStatus = async () => {
    try {
      const response = await fetch('http://localhost:5001/health');
      const data = await response.json();
      
      if (data.status === 'healthy') {
        setServerStatus('online');
        setServerInfo(data);
      } else {
        setServerStatus('degraded');
      }
    } catch (error) {
      setServerStatus('offline');
      console.error('Server health check failed:', error);
    }
  };

  const getNetworkName = (id) => {
    const networks = {
      '1': 'Ethereum Mainnet',
      '11155111': 'Sepolia Testnet',
      '137': 'Polygon',
      '42161': 'Arbitrum One',
    };
    return networks[id] || `Chain ${id}`;
  };

  const getStatusColor = (status) => {
    const colors = {
      online: '#10b981',
      degraded: '#f59e0b',
      offline: '#ef4444',
      checking: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  return (
    <div className="status-panel">
      <div className="status-grid">
        {/* Connection Status */}
        <div className="status-item">
          <div className="status-label">Wallet</div>
          <div className="status-value">
            <span 
              className="status-indicator" 
              style={{ backgroundColor: isConnected ? '#10b981' : '#ef4444' }}
            />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Network */}
        <div className="status-item">
          <div className="status-label">Network</div>
          <div className="status-value">
            {chainId ? getNetworkName(chainId) : 'Not Connected'}
          </div>
        </div>

        {/* Account */}
        <div className="status-item">
          <div className="status-label">Account</div>
          <div className="status-value">
            {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'N/A'}
          </div>
        </div>

        {/* Proof System */}
        <div className="status-item">
          <div className="status-label">Proof System</div>
          <div className="status-value">
            <span className="proof-badge">{proofSystem.toUpperCase()}</span>
          </div>
        </div>

        {/* Backend Server */}
        <div className="status-item">
          <div className="status-label">Backend</div>
          <div className="status-value">
            <span 
              className="status-indicator" 
              style={{ backgroundColor: getStatusColor(serverStatus) }}
            />
            {serverStatus.charAt(0).toUpperCase() + serverStatus.slice(1)}
          </div>
        </div>

        {/* Avg Proof Time */}
        <div className="status-item">
          <div className="status-label">Avg Proof Time</div>
          <div className="status-value">
            {serverInfo?.avgProofTime || '~100ms'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;