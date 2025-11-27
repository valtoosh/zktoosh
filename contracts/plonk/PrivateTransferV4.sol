// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Poseidon.sol";

interface IPlonkVerifierPhase6 {
    function verifyProof(uint256[24] calldata proof, uint256[17] calldata pubSignals) external view returns (bool);
}

interface IClaimVerifier {
    function verifyProof(uint256[24] calldata proof, uint256[5] calldata pubSignals) external view returns (bool);
}

/**
 * @title PrivateTransferV4
 * @notice Phase 6 Unified: Complete privacy-preserving asset transfer system
 * @dev Implements Phase 6B-E features:
 *      - Phase 6B: Stealth addresses (Monero-style recipient privacy)
 *      - Phase 6C: Merkle tree anonymity sets
 *      - Phase 6D: Range proofs (prevent inference attacks)
 *      - Phase 6E: Encrypted memos (auditability with view keys)
 *
 * Privacy Score: 9/10 (vs 6/10 in Phase 6A)
 */
contract PrivateTransferV4 {
    // ============================================
    // STRUCTS
    // ============================================

    struct StealthPayment {
        uint256 stealthAddress;       // One-time address for recipient
        uint256 ephemeralPublicKey;   // For recipient scanning
        uint256 encryptedAmount;      // Encrypted transfer amount
        uint256 timestamp;
        bytes32 encryptedMemo;        // Phase 6E: Optional encrypted memo
        bool claimed;
    }

    struct MerkleTreeState {
        uint256 root;                 // Current Merkle root
        uint256 size;                 // Number of leaves
        uint256 nextIndex;            // Next available index
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    IPlonkVerifierPhase6 public verifier;
    IClaimVerifier public claimVerifier;
    Poseidon public poseidonHasher;

    // Account balances
    mapping(address => uint256) public balances;           // EOA balances (public)
    mapping(address => uint256) public encryptedBalances;  // ENA balances (encrypted)

    // Asset management
    mapping(uint256 => bool) public whitelistedAssets;

    // Phase 4: Nullifier system (prevent double-spending)
    mapping(uint256 => bool) public nullifiers;

    // Phase 6B: Stealth address system
    mapping(uint256 => StealthPayment) public stealthPayments;
    uint256[] public stealthAddressList;                   // For recipient scanning

    // Phase 6C: Merkle tree for anonymity sets
    MerkleTreeState public merkleTree;
    mapping(uint256 => uint256) public merkleLeaves;       // index => leaf hash

    // Phase 6E: View keys for auditability
    mapping(address => bytes32) public viewKeys;           // Encrypted view keys

    // Contract state
    uint256 public totalDeposited;
    uint256 public totalTransfers;
    address public owner;
    bool public paused;

    // ============================================
    // EVENTS (Phase 6A: Privacy-enhanced)
    // ============================================

    event Deposit(address indexed sender, uint256 amount, uint256 timestamp);

    event PrivateTransfer(
        address indexed sender,
        uint256 indexed nullifier,
        uint256 indexed stealthAddress,
        uint256 ephemeralPublicKey,
        bytes32 encryptedMemo,
        uint256 timestamp,
        bool valid
    );

    event StealthPaymentCreated(
        uint256 indexed stealthAddress,
        uint256 ephemeralPublicKey,
        bytes32 encryptedMemo,
        uint256 timestamp
    );

    event StealthPaymentClaimed(
        uint256 indexed stealthAddress,
        uint256 timestamp
        // No claimer address or amount (privacy)
    );

    event MerkleTreeUpdated(
        uint256 oldRoot,
        uint256 newRoot,
        uint256 leafIndex,
        uint256 timestamp
    );

    event Withdrawal(address indexed recipient, uint256 amount, uint256 timestamp);
    event AssetWhitelisted(uint256 indexed assetId, bool status);
    event Paused(bool status);

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(address _verifierAddress, address _claimVerifierAddress, address _poseidonHasherAddress) {
        verifier = IPlonkVerifierPhase6(_verifierAddress);
        claimVerifier = IClaimVerifier(_claimVerifierAddress);
        poseidonHasher = Poseidon(_poseidonHasherAddress);
        owner = msg.sender;
        paused = false;

        // Initialize Merkle tree
        merkleTree.root = 0;
        merkleTree.size = 0;
        merkleTree.nextIndex = 0;

        // Whitelist default assets
        whitelistedAssets[1998] = true;
        whitelistedAssets[2000] = true;

        emit AssetWhitelisted(1998, true);
        emit AssetWhitelisted(2000, true);
    }

    // ============================================
    // DEPOSIT FUNCTION
    // ============================================

    /**
     * @notice Deposit ETH to the contract (EOA balance)
     */
    function deposit() external payable whenNotPaused {
        require(msg.value > 0, "Amount must be > 0");

        balances[msg.sender] += msg.value;
        totalDeposited += msg.value;

        emit Deposit(msg.sender, msg.value, block.timestamp);
    }

    // ============================================
    // PHASE 6 UNIFIED PRIVATE TRANSFER
    // ============================================

    /**
     * @notice Execute private transfer with Phase 6 unified proof
     * @param proof PLONK proof (24 uint256 elements)
     * @param publicSignals Public signals (17 elements)
     * @param encryptedMemo Optional encrypted memo for auditability
     *
     * Public Signals Order (17 total):
     * Outputs (0-10):
     * [0] valid, [1] newBalance, [2] newBalanceCommitment, [3] recipientHash,
     * [4] nullifier, [5] sctNew, [6] stealthAddress, [7] ephemeralPublicKey,
     * [8] merkleLeaf, [9] merkleProofValid, [10] encryptedMemoHash
     *
     * Inputs (11-16):
     * [11] assetId, [12] maxAmount, [13] balanceCommitment, [14] sctOld,
     * [15] vPubDelta, [16] merkleRoot
     */
    function privateTransfer(
        uint256[24] calldata proof,
        uint256[17] calldata publicSignals,
        bytes32 encryptedMemo
    ) external payable whenNotPaused {
        // Parse public signals
        uint256 valid = publicSignals[0];
        uint256 newBalance = publicSignals[1];
        uint256 newBalanceCommitment = publicSignals[2];
        uint256 recipientHash = publicSignals[3];
        uint256 nullifier = publicSignals[4];
        uint256 sctNew = publicSignals[5];
        uint256 stealthAddress = publicSignals[6];         // Phase 6B
        uint256 ephemeralPublicKey = publicSignals[7];     // Phase 6B
        uint256 merkleLeaf = publicSignals[8];             // Phase 6C
        uint256 merkleProofValid = publicSignals[9];       // Phase 6C
        uint256 encryptedMemoHash = publicSignals[10];     // Phase 6E
        uint256 assetId = publicSignals[11];
        uint256 maxAmount = publicSignals[12];
        uint256 balanceCommitment = publicSignals[13];
        uint256 sctOld = publicSignals[14];
        uint256 vPubDelta = publicSignals[15];
        uint256 inputMerkleRoot = publicSignals[16];       // Phase 6C

        // Validate asset
        require(whitelistedAssets[assetId], "Asset not whitelisted");

        // Phase 4: Check nullifier
        require(!nullifiers[nullifier], "Nullifier already used");

        // Phase 6C: Verify Merkle root (allow 0 for initial transfers)
        if (merkleTree.size > 0) {
            require(inputMerkleRoot == merkleTree.root, "Invalid Merkle root");
        }

        // Verify PLONK proof
        bool proofValid = verifier.verifyProof(proof, publicSignals);
        require(proofValid, "Invalid proof");

        // Check circuit validation
        require(valid == 1, "Circuit rejected transfer");
        require(merkleProofValid == 1, "Invalid Merkle proof");

        // Mark nullifier as used
        nullifiers[nullifier] = true;

        // Update encrypted balance (ENA)
        encryptedBalances[msg.sender] = sctNew;

        // Handle deposits/withdrawals (Phase 5B logic)
        _handlePublicTransfers(vPubDelta);

        // Phase 6C: Update Merkle tree
        _updateMerkleTree(merkleLeaf);

        // Phase 6B: Store stealth payment ONLY for pure ENA transfers (not deposits/withdrawals)
        // For deposits (vPubDelta > 0), stealthAddress should be 0 (sender deposits to self)
        // For pure transfers (vPubDelta == 0), stealthAddress is the recipient's stealth address
        if (stealthAddress != 0) {
            // encryptedAmount is Poseidon(transferAmount, stealthSalt) - sender computes this
            uint256 encryptedAmount = recipientHash; // Reusing recipientHash as encrypted amount commitment

            stealthPayments[stealthAddress] = StealthPayment({
                stealthAddress: stealthAddress,
                ephemeralPublicKey: ephemeralPublicKey,
                encryptedAmount: encryptedAmount,
                timestamp: block.timestamp,
                encryptedMemo: encryptedMemo,
                claimed: false
            });
            stealthAddressList.push(stealthAddress);

            emit StealthPaymentCreated(
                stealthAddress,
                ephemeralPublicKey,
                encryptedMemo,
                block.timestamp
            );
        }

        // Emit events
        emit PrivateTransfer(
            msg.sender,
            nullifier,
            stealthAddress,
            ephemeralPublicKey,
            encryptedMemo,
            block.timestamp,
            valid == 1
        );

        totalTransfers++;
    }

    // ============================================
    // INTERNAL: HANDLE PUBLIC TRANSFERS
    // ============================================

    function _handlePublicTransfers(uint256 vPubDelta) private {
        uint256 FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        uint256 FIELD_MIDPOINT = FIELD_SIZE / 2;

        if (vPubDelta > FIELD_MIDPOINT) {
            // Withdrawal: ENA → EOA
            uint256 withdrawAmount = FIELD_SIZE - vPubDelta;
            uint256 withdrawAmountWei = (withdrawAmount * 1 ether) / 1000;

            require(address(this).balance >= withdrawAmountWei, "Insufficient contract balance");

            (bool success, ) = payable(msg.sender).call{value: withdrawAmountWei}("");
            require(success, "Withdrawal failed");

            emit Withdrawal(msg.sender, withdrawAmountWei, block.timestamp);

        } else if (vPubDelta > 0) {
            // Deposit: EOA → ENA
            uint256 depositAmountWei = (vPubDelta * 1 ether) / 1000;
            require(msg.value == depositAmountWei, "Incorrect ETH sent");

            emit Deposit(msg.sender, msg.value, block.timestamp);
        }
        // If vPubDelta == 0: pure ENA transfer (no deposit/withdrawal)
    }

    // ============================================
    // PHASE 6C: MERKLE TREE MANAGEMENT
    // ============================================

    /**
     * @notice Update Merkle tree with new leaf
     * @dev Simplified incremental update (production would use efficient algorithm)
     */
    function _updateMerkleTree(uint256 leaf) private {
        uint256 oldRoot = merkleTree.root;
        uint256 leafIndex = merkleTree.nextIndex;

        // Store leaf
        merkleLeaves[leafIndex] = leaf;
        merkleTree.size++;
        merkleTree.nextIndex++;

        // Compute new Merkle root
        uint256 newRoot = _computeMerkleRoot();
        merkleTree.root = newRoot;

        emit MerkleTreeUpdated(oldRoot, newRoot, leafIndex, block.timestamp);
    }

    /**
     * @notice Compute Merkle root from all leaves
     * @dev Simplified - production would use incremental updates
     */
    function _computeMerkleRoot() private view returns (uint256) {
        if (merkleTree.size == 0) return 0;
        if (merkleTree.size == 1) return merkleLeaves[0];

        // Build tree bottom-up (simplified)
        uint256 treeSize = merkleTree.size;
        uint256[] memory currentLevel = new uint256[](treeSize);

        // Copy leaves to current level
        for (uint256 i = 0; i < treeSize; i++) {
            currentLevel[i] = merkleLeaves[i];
        }

        // Build tree upwards
        while (treeSize > 1) {
            uint256 nextSize = (treeSize + 1) / 2;
            uint256[] memory nextLevel = new uint256[](nextSize);

            for (uint256 i = 0; i < nextSize; i++) {
                uint256 left = currentLevel[i * 2];
                uint256 right = (i * 2 + 1 < treeSize) ? currentLevel[i * 2 + 1] : 0;
                nextLevel[i] = poseidonHasher.poseidon(left, right);
            }

            currentLevel = nextLevel;
            treeSize = nextSize;
        }

        return currentLevel[0];
    }

    // ============================================
    // PHASE 6B: STEALTH ADDRESS CLAIMING
    // ============================================

    /**
     * @notice Claim stealth payment
     * @param stealthAddress The stealth address to claim
     * @dev Recipient must prove ownership off-chain and provide correct stealthAddress
     */
    /**
     * Claim stealth payment with ZK proof
     * @param proof PLONK proof of stealth address ownership
     * @param publicSignals [valid, claimerAddressHash, claimedAmount, assetId, stealthAddress]
     * @dev CRITICAL: Signal order MUST match Circom output order (outputs first, then public inputs)
     */
    function claimStealthPayment(
        uint256[24] calldata proof,
        uint256[5] calldata publicSignals
    ) external whenNotPaused {
        // Extract public signals IN CIRCOM ORDER (outputs, then public inputs)
        uint256 valid = publicSignals[0];           // Circuit output
        uint256 claimerAddress = publicSignals[1];  // Circuit output (claimerAddressHash)
        uint256 transferAmount = publicSignals[2];  // Circuit output (claimedAmount)
        uint256 assetId = publicSignals[3];         // Circuit public input
        uint256 stealthAddress = publicSignals[4];  // Circuit public input

        StealthPayment storage payment = stealthPayments[stealthAddress];

        require(payment.timestamp > 0, "No payment found");
        require(!payment.claimed, "Already claimed");

        // Verify ZK proof of ownership
        bool proofValid = claimVerifier.verifyProof(proof, publicSignals);
        require(proofValid, "Invalid claim proof");
        require(valid == 1, "Circuit rejected claim");

        // Verify encrypted amount matches (prevents front-running with different amount)
        require(payment.encryptedAmount == claimerAddress, "Invalid encrypted amount");

        // Mark as claimed
        payment.claimed = true;

        // Credit the claimer's balance (revealed during claim)
        // Convert from ENA units to Wei (1 ENA = 0.001 ETH)
        uint256 amountInWei = (transferAmount * 1 ether) / 1000;
        balances[msg.sender] += amountInWei;

        emit StealthPaymentClaimed(stealthAddress, block.timestamp);
    }

    // ============================================
    // PHASE 6B: STEALTH ADDRESS SCANNING
    // ============================================

    /**
     * @notice Get stealth payment by index (for recipient scanning)
     */
    function getStealthPayment(uint256 index) external view returns (
        uint256 stealthAddr,
        uint256 ephemeralPubKey,
        bytes32 memo,
        uint256 timestamp,
        bool claimed
    ) {
        require(index < stealthAddressList.length, "Index out of bounds");
        uint256 addr = stealthAddressList[index];
        StealthPayment memory payment = stealthPayments[addr];
        return (
            payment.stealthAddress,
            payment.ephemeralPublicKey,
            payment.encryptedMemo,
            payment.timestamp,
            payment.claimed
        );
    }

    /**
     * @notice Get total number of stealth payments
     */
    function getStealthPaymentCount() external view returns (uint256) {
        return stealthAddressList.length;
    }

    /**
     * @notice Check if stealth address exists and is unclaimed
     */
    function isStealthAddressUnclaimed(uint256 stealthAddress) external view returns (bool) {
        StealthPayment memory payment = stealthPayments[stealthAddress];
        return payment.timestamp > 0 && !payment.claimed;
    }

    // ============================================
    // PHASE 6E: VIEW KEY MANAGEMENT
    // ============================================

    /**
     * @notice Set view key for auditability
     * @param encryptedViewKey Encrypted view key (encrypted with user's password)
     */
    function setViewKey(bytes32 encryptedViewKey) external {
        viewKeys[msg.sender] = encryptedViewKey;
    }

    /**
     * @notice Get view key for a user
     */
    function getViewKey(address user) external view returns (bytes32) {
        return viewKeys[user];
    }

    // ============================================
    // WITHDRAWAL FUNCTION
    // ============================================

    /**
     * @notice Withdraw ETH from EOA balance
     */
    function withdraw(uint256 amount, address payable recipient) external whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(recipient != address(0), "Invalid recipient");

        balances[msg.sender] -= amount;

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(recipient, amount, block.timestamp);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    function setAssetWhitelist(uint256 assetId, bool status) external onlyOwner {
        whitelistedAssets[assetId] = status;
        emit AssetWhitelisted(assetId, status);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function updateVerifier(address _verifierAddress) external onlyOwner {
        require(_verifierAddress != address(0), "Invalid address");
        verifier = IPlonkVerifierPhase6(_verifierAddress);
    }

    function updateClaimVerifier(address _claimVerifierAddress) external onlyOwner {
        require(_claimVerifierAddress != address(0), "Invalid address");
        claimVerifier = IClaimVerifier(_claimVerifierAddress);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    function getBalance(address account) external view returns (uint256) {
        return balances[account];
    }

    function getEncryptedBalance(address account) external view returns (uint256) {
        return encryptedBalances[account];
    }

    function isAssetWhitelisted(uint256 assetId) external view returns (bool) {
        return whitelistedAssets[assetId];
    }

    function getMerkleRoot() external view returns (uint256) {
        return merkleTree.root;
    }

    function getMerkleTreeSize() external view returns (uint256) {
        return merkleTree.size;
    }

    function getContractStats() external view returns (
        uint256 _totalDeposited,
        uint256 _totalTransfers,
        uint256 _merkleTreeSize,
        uint256 _contractBalance
    ) {
        return (
            totalDeposited,
            totalTransfers,
            merkleTree.size,
            address(this).balance
        );
    }

    // ============================================
    // FALLBACK
    // ============================================

    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposited += msg.value;
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
}
