// Decode the transaction data from the error
const txData = "0x4259893f0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000036000000000000000000000000000000000000000000000000000000000000003001371ce18b56f5b2bba28a80bdd7ee9c120b8ffa3a7a3f0dc8878954e92fc07421dc827be32fc9aa82fb2b5fb6ecd30d72ac0cda39d3d0ebbd5d97fb25b9160582170e02fb75f7b8fa4f0020f8642461a9a003a191d8227e5e21dda4abfff8ae321f0eeee15f43c98d165318d5449cef05a05cd47ee1f076ec6ea4c9dbe6da4261b80fd9ba436f6f9c4ca5bd87f46847f6813f2fe86e69c6c3e15c1c8c604ec2423283675c0e420da6b3a870e82baafe6d077c6798f8c84086c5d82640ef81402017cb7f9f7dde196119d9013ea7a5c6964a3f844a246ab63083551f5690901ad2afe5cb5b93c6e61d60ce573728b115d9b6ce66dba4980dfabde6dc657615df80479340f83fb43fea91d662b9a05b41ea337c56a0065f8f43a7f92b23c2cf5b22cef4deba1526898db80b40f1710474821aa96317d2de069e21be55df5a3c7e11c22fb926f07b2ccca0e6561c8c03b2f4650fbf15df3d4d0f9d37651d75b5e330e2782142c9cbc547afbfeed5e12b6f5abd3084d575f7cb94f296b98cbe4b23100f91c402aa4b63708e363506e4e693d11d7a5bad306f3221002b366d611e6e7140327079e007ae0d8c1616e2767adfcd7c5e0b9310c73116acf5d7b6c7d59522ef32958b49ac637618536617d39b2994e2653ce01c0e10ae895f718499fe6a0193dfd83e7b8c9566fd91c7f713d5b4c9b3bc25e10b830534432927641530879257ed4034719ed7a4ba615846871b05a7c5bbabd8c841077ab6299e1b2c32be61638e7956e0393fe93c5ca1769c2c0fbf3dd6823899ef9d20efbe313fbebd9e60925b51fc1500c0a207960fefe5c77fb9008f0a9d3b3c95566d4810ebd1707e201101df12d1ce58dfc5caaede71783525fe04edb02d070171edc3b2c795a46381b5cc62e3d0772562d1c0502580655b8b6e702c417b7cf55fade4329378f9d261aa3fc1202dcc9dcb498ac3aa447f4d9be7ee8329ba1182a4c6792e28d5976e41e945885fa9cf94ed82758122dc9c1a62a17207700c9b81150f82f3fb6fa321907303a7ed684fd78906e4f74a20049ec3af2946a7ced5b1f96d5b36fea8ac5320000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000017112d9ebd6eeae51d61f74275763118fb109e139fa8175816aaefaa7db5d3f0cdc900000000000000000000000000000000000000000000000000000000000007ce0000000000000000000000000000000000000000000000000000000000002ee010e642f2f43df9cdbcfe719429d0abf34176001e87d5cd0525bcd143f7cfed2e";

// Function selector: first 4 bytes
const selector = txData.substring(0, 10);
console.log('Function selector:', selector);
console.log('Expected privateTransfer selector:', '0x4259893f');

// Parse the ABI-encoded data
const dataWithoutSelector = txData.substring(10);

// Decode offsets (each is 32 bytes = 64 hex chars)
const offset1 = parseInt(dataWithoutSelector.substring(0, 64), 16);
const offset2 = parseInt(dataWithoutSelector.substring(64, 128), 16);

console.log('\nOffsets:');
console.log('  Proof offset:', offset1, '(0x' + offset1.toString(16) + ')');
console.log('  Signals offset:', offset2, '(0x' + offset2.toString(16) + ')');

// Extract proof length (at offset1)
const proofLengthHex = dataWithoutSelector.substring(offset1 * 2, offset1 * 2 + 64);
const proofLength = parseInt(proofLengthHex, 16);
console.log('\nProof:');
console.log('  Length:', proofLength, 'bytes');
console.log('  Expected: 768 bytes');

// Extract signals length (at offset2)
const signalsLengthHex = dataWithoutSelector.substring(offset2 * 2, offset2 * 2 + 64);
const signalsLength = parseInt(signalsLengthHex, 16);
console.log('\nPublic Signals:');
console.log('  Count:', signalsLength);
console.log('  Expected: 6');

// Extract signals
const signalsStart = offset2 * 2 + 64;
console.log('\nSignal values:');
for (let i = 0; i < signalsLength; i++) {
  const signalHex = dataWithoutSelector.substring(signalsStart + i * 64, signalsStart + (i + 1) * 64);
  const signalValue = BigInt('0x' + signalHex);
  console.log(`  [${i}]:`, signalValue.toString());
}

// Expected values
console.log('\nExpected signal values:');
console.log('  [0]: 1 (valid)');
console.log('  [1]: 5905 (newBalance)');
console.log('  [2]: <newBalanceCommitment>');
console.log('  [3]: 1998 (assetId)');
console.log('  [4]: 12000 (maxAmount)');
console.log('  [5]: <balanceCommitment>');
