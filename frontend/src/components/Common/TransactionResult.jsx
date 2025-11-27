// frontend/src/components/Common/TransactionResult.jsx
import React from 'react';
import './TransactionResult.css';

const TransactionResult = ({ result, onClose }) => {
  if (!result) return null;

  const isError = result.error || result.message?.includes('failed');

  return (
    <div className="transaction-result-overlay">
      <div className={`transaction-result ${isError ? 'error' : 'success'}`}>
        <div className="result-header">
          <div className="result-icon">
            {isError ? '❌' : '✅'}
          </div>
          <h3>{isError ? 'Transaction Failed' : 'Transaction Successful!'}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="result-content">
          {isError ? (
            <div className="error-message">
              <p>{result.error || result.message}</p>
            </div>
          ) : (
            <>
              <div className="success-message">
                <p>{result.message}</p>
              </div>

              <div className="result-stats">
                {result.transactionHash && (
                  <div className="stat-item">
                    <span className="stat-label">Transaction Hash:</span>
                    <a
                      href={result.etherscanUrl || `https://sepolia.etherscan.io/tx/${result.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="stat-value link"
                    >
                      {result.transactionHash.slice(0, 10)}...{result.transactionHash.slice(-8)}
                    </a>
                  </div>
                )}

                {result.blockNumber && (
                  <div className="stat-item">
                    <span className="stat-label">Block Number:</span>
                    <span className="stat-value">{result.blockNumber}</span>
                  </div>
                )}

                {result.gasUsed && (
                  <div className="stat-item">
                    <span className="stat-label">Gas Used:</span>
                    <span className="stat-value">{parseInt(result.gasUsed).toLocaleString()}</span>
                  </div>
                )}

                {result.proofTime && (
                  <div className="stat-item">
                    <span className="stat-label">Proof Generation:</span>
                    <span className="stat-value">{result.proofTime}ms</span>
                  </div>
                )}

                {result.newBalance !== undefined && (
                  <div className="stat-item">
                    <span className="stat-label">New Balance:</span>
                    <span className="stat-value">{result.newBalance}</span>
                  </div>
                )}
              </div>

              {result.etherscanUrl && (
                <div className="result-actions">
                  <a
                    href={result.etherscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-button primary"
                  >
                    🔍 View on Etherscan
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        <div className="result-footer">
          <button className="action-button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionResult;
