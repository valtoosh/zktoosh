const { ethers } = require('ethers');

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/dbde77edfe80476f96a9db02e3eb8a83');
  
  const contractAddress = '0xEeBb97aE6980FD1E2E271FC58b58BAAfDCEd034c';
  const senderAddress = '0xA1090527ac5c019Abc3989F405a5a63bB008008D';
  
  const abi = [
    'function balances(address) external view returns (uint256)',
    'function encryptedBalances(address) external view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  console.log('🔍 Checking sender balance on contract:', contractAddress);
  console.log('Sender address:', senderAddress);
  console.log('');
  
  try {
    const balance = await contract.balances(senderAddress);
    const encBalance = await contract.encryptedBalances(senderAddress);
    
    console.log('Contract Balance (Wei):', balance.toString());
    console.log('Contract Balance (ETH):', ethers.formatEther(balance));
    console.log('Encrypted Balance:', encBalance.toString());
    
    // Convert to ENA (contract uses 10^6 scale)
    const balanceInENA = Math.floor(parseFloat(ethers.formatEther(balance)) * 1e6);
    console.log('Contract Balance (ENA):', balanceInENA);
    
    if (balance === 0n) {
      console.log('\n❌ PROBLEM: Sender has NO balance on this contract!');
      console.log('   You need to deposit ETH first using the deposit function.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBalance();
