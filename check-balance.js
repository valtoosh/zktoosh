const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161');
  
  const contractAddress = '0xAa5da3d6d7671b2961b230D8676Bf8287008A8D3';
  const userAddress = '0xA1090527ac5c019Abc3989F405a5a63bB008008D';
  
  const abi = [
    'function balances(address) external view returns (uint256)',
    'function encryptedBalances(address) external view returns (uint256)'
  ];
  
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  const balance = await contract.balances(userAddress);
  const encBalance = await contract.encryptedBalances(userAddress);
  
  console.log('\n📊 Contract Balance Check');
  console.log('========================');
  console.log('Contract:', contractAddress);
  console.log('User:', userAddress);
  console.log('Balance (Wei):', balance.toString());
  console.log('Balance (ETH):', ethers.formatEther(balance));
  console.log('Balance (ENA):', Math.floor(parseFloat(ethers.formatEther(balance)) * 1e6));
  console.log('Encrypted Balance:', encBalance.toString());
}

main();
