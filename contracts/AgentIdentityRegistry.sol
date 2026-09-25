// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @notice ERC-8004-inspired agent identity registry (v1, founder-custodied).
 * Each agent in a solo builder's fleet gets a verifiable on-chain identity
 * (an ERC-721 token) whose tokenURI resolves to an off-chain JSON profile
 * (name, role, model, capabilities, controllerAddress). v1 scope: identities
 * are custodied by the founder's wallet, not agent-controlled signing keys --
 * see README for the disclosed v1/v2 boundary.
 */
contract AgentIdentityRegistry is ERC721 {
    uint256 public nextAgentId = 1;

    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => bool) public revoked;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string tokenURI);
    event AgentRevoked(uint256 indexed agentId);

    constructor() ERC721("SafeReceipt Agent Identity", "SRAI") {}

    function registerAgent(string calldata agentTokenURI) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        _tokenURIs[agentId] = agentTokenURI; // set before _safeMint's receiver callback
        _safeMint(msg.sender, agentId);

        emit AgentRegistered(agentId, msg.sender, agentTokenURI);
    }

    function revokeAgent(uint256 agentId) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        require(!revoked[agentId], "Already revoked");

        revoked[agentId] = true;

        emit AgentRevoked(agentId);
    }

    function tokenURI(uint256 agentId) public view override returns (string memory) {
        _requireOwned(agentId);
        return _tokenURIs[agentId];
    }

    function isActive(uint256 agentId) external view returns (bool) {
        _requireOwned(agentId);
        return !revoked[agentId];
    }
}
