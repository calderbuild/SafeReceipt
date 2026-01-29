// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ReceiptRegistry {
    uint256 public nextReceiptId = 1;

    enum Status {
        CREATED,    // Receipt created, no tx linked yet
        EXECUTED,   // Transaction linked, pending verification
        VERIFIED,   // Transaction verified to match intent
        MISMATCH    // Transaction does NOT match intent
    }

    struct Receipt {
        address actor;
        uint8 actionType;
        uint8 riskScore;
        uint40 timestamp;
        bytes32 intentHash;
        bytes32 proofHash;
        bytes32 txHash;      // Linked transaction hash
        Status status;
    }

    mapping(uint256 => Receipt) public receipts;
    mapping(address => uint256[]) public userReceipts;

    event ReceiptCreated(
        uint256 indexed receiptId,
        address indexed actor,
        uint8 indexed actionType,
        bytes32 intentHash,
        bytes32 proofHash,
        uint8 riskScore,
        uint256 timestamp
    );

    event ExecutionLinked(
        uint256 indexed receiptId,
        bytes32 indexed txHash,
        Status status
    );

    function createReceipt(
        uint8 actionType,
        bytes32 intentHash,
        bytes32 proofHash,
        uint8 riskScore
    ) external returns (uint256 receiptId) {
        receiptId = nextReceiptId++;

        receipts[receiptId] = Receipt({
            actor: msg.sender,
            actionType: actionType,
            riskScore: riskScore,
            timestamp: uint40(block.timestamp),
            intentHash: intentHash,
            proofHash: proofHash,
            txHash: bytes32(0),
            status: Status.CREATED
        });

        userReceipts[msg.sender].push(receiptId);

        emit ReceiptCreated(
            receiptId,
            msg.sender,
            actionType,
            intentHash,
            proofHash,
            riskScore,
            block.timestamp
        );
    }

    /**
     * @notice Link a transaction to a receipt and set its verification status
     * @param receiptId The receipt to link
     * @param txHash The transaction hash that executed the intent
     * @param verified True if tx matches intent, false if mismatch
     */
    function linkExecution(
        uint256 receiptId,
        bytes32 txHash,
        bool verified
    ) external {
        Receipt storage receipt = receipts[receiptId];
        require(receipt.actor == msg.sender, "Not receipt owner");
        require(receipt.status == Status.CREATED, "Already linked");

        receipt.txHash = txHash;
        receipt.status = verified ? Status.VERIFIED : Status.MISMATCH;

        emit ExecutionLinked(receiptId, txHash, receipt.status);
    }

    function getReceipt(uint256 receiptId) external view returns (Receipt memory) {
        return receipts[receiptId];
    }

    function getUserReceipts(address user) external view returns (uint256[] memory) {
        return userReceipts[user];
    }
}
