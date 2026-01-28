// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ReceiptRegistry {
    uint256 public nextReceiptId = 1;
    
    struct Receipt {
        address actor;
        uint8 actionType;
        uint8 riskScore;
        uint40 timestamp;
        bytes32 intentHash;
        bytes32 proofHash;
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
            proofHash: proofHash
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
    
    function getReceipt(uint256 receiptId) external view returns (Receipt memory) {
        return receipts[receiptId];
    }
    
    function getUserReceipts(address user) external view returns (uint256[] memory) {
        return userReceipts[user];
    }
}
