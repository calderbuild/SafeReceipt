// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice V2 of ReceiptRegistry.sol -- same CREATED -> VERIFIED/MISMATCH state
 * machine, generalized from "one ERC20 approve" to any agent action, on-chain
 * or off-chain. ReceiptRegistry.sol (V1) is left deployed and untouched; this
 * is a new contract, not an upgrade, since Receipt's on-chain layout can't
 * gain fields in place.
 *
 * Two outcome paths converge on the same Status lifecycle:
 *  - linkExecution():        on-chain action, outcome = the actual tx hash
 *  - linkOffChainOutcome():  off-chain action, outcome = hash of a published
 *                            trace (commit-reveal; see evidenceURI)
 *
 * `verified` in both paths is computed off-chain (client-side, open source,
 * independently re-runnable) and submitted as a boolean -- this contract
 * timestamps the result immutably, it does not itself decode calldata or
 * re-derive the hash. Same trust model as V1's linkExecution, made explicit
 * here rather than left implicit.
 */
contract ActionRegistry {
    uint256 public nextReceiptId = 1;

    enum Status {
        CREATED,    // Receipt created, no outcome linked yet
        EXECUTED,   // reserved for parity with V1; unused in normal flow
        VERIFIED,   // Outcome verified to match declared intent
        MISMATCH    // Outcome does NOT match declared intent
    }

    // 0 = ON_CHAIN_APPROVE, 1 = ON_CHAIN_TRANSFER, 2 = OFF_CHAIN_ACTION
    uint8 public constant ON_CHAIN_APPROVE = 0;
    uint8 public constant ON_CHAIN_TRANSFER = 1;
    uint8 public constant OFF_CHAIN_ACTION = 2;

    struct Receipt {
        address actor;
        uint256 agentId;      // AgentIdentityRegistry token id; 0 = no registered identity
        uint8 actionType;
        uint8 riskScore;
        uint40 timestamp;
        bytes32 intentHash;
        bytes32 proofHash;
        bytes32 outcomeHash;  // tx hash (on-chain) or trace hash (off-chain)
        string evidenceURI;   // public pointer to full trace/tx evidence JSON
        Status status;
    }

    mapping(uint256 => Receipt) public receipts;
    mapping(address => uint256[]) public userReceipts;
    mapping(uint256 => uint256[]) public agentReceipts; // agentId => receiptIds

    event ReceiptCreated(
        uint256 indexed receiptId,
        uint256 indexed agentId,
        uint8 indexed actionType,
        address actor,
        bytes32 intentHash,
        bytes32 proofHash,
        uint8 riskScore,
        uint256 timestamp
    );

    event OutcomeLinked(
        uint256 indexed receiptId,
        uint256 indexed agentId,
        uint8 indexed status,
        bytes32 outcomeHash,
        string evidenceURI
    );

    function createReceipt(
        uint256 agentId,
        uint8 actionType,
        bytes32 intentHash,
        bytes32 proofHash,
        uint8 riskScore
    ) external returns (uint256 receiptId) {
        receiptId = nextReceiptId++;

        receipts[receiptId] = Receipt({
            actor: msg.sender,
            agentId: agentId,
            actionType: actionType,
            riskScore: riskScore,
            timestamp: uint40(block.timestamp),
            intentHash: intentHash,
            proofHash: proofHash,
            outcomeHash: bytes32(0),
            evidenceURI: "",
            status: Status.CREATED
        });

        userReceipts[msg.sender].push(receiptId);
        if (agentId != 0) {
            agentReceipts[agentId].push(receiptId);
        }

        emit ReceiptCreated(
            receiptId,
            agentId,
            actionType,
            msg.sender,
            intentHash,
            proofHash,
            riskScore,
            block.timestamp
        );
    }

    /// @notice Link an on-chain transaction to a receipt (ON_CHAIN_APPROVE / ON_CHAIN_TRANSFER).
    function linkExecution(
        uint256 receiptId,
        bytes32 txHash,
        bool verified,
        string calldata evidenceURI
    ) external {
        _linkOutcome(receiptId, txHash, verified, evidenceURI);
    }

    /// @notice Link an off-chain action's outcome to a receipt (OFF_CHAIN_ACTION).
    /// Same state machine as linkExecution; outcomeHash is a trace hash, not a tx hash.
    function linkOffChainOutcome(
        uint256 receiptId,
        bytes32 outcomeHash,
        bool verified,
        string calldata evidenceURI
    ) external {
        _linkOutcome(receiptId, outcomeHash, verified, evidenceURI);
    }

    function _linkOutcome(
        uint256 receiptId,
        bytes32 outcomeHash,
        bool verified,
        string calldata evidenceURI
    ) private {
        Receipt storage receipt = receipts[receiptId];
        require(receipt.actor == msg.sender, "Not receipt owner");
        require(receipt.status == Status.CREATED, "Already linked");

        receipt.outcomeHash = outcomeHash;
        receipt.evidenceURI = evidenceURI;
        receipt.status = verified ? Status.VERIFIED : Status.MISMATCH;

        emit OutcomeLinked(receiptId, receipt.agentId, uint8(receipt.status), outcomeHash, evidenceURI);
    }

    function getReceipt(uint256 receiptId) external view returns (Receipt memory) {
        return receipts[receiptId];
    }

    function getUserReceipts(address user) external view returns (uint256[] memory) {
        return userReceipts[user];
    }

    function getAgentReceipts(uint256 agentId) external view returns (uint256[] memory) {
        return agentReceipts[agentId];
    }
}
