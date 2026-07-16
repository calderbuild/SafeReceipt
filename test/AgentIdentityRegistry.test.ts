import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentIdentityRegistry } from "../typechain-types";

describe("AgentIdentityRegistry", function () {
  let registry: AgentIdentityRegistry;
  let owner: any;
  let addr1: any;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgentIdentityRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct initial agent ID and ERC-721 metadata", async function () {
      expect(await registry.nextAgentId()).to.equal(1);
      expect(await registry.name()).to.equal("SafeReceipt Agent Identity");
      expect(await registry.symbol()).to.equal("SRAI");
    });
  });

  describe("Agent Registration", function () {
    const profileURI = "https://safereceipt.vercel.app/agents/doc-researcher.json";

    it("Should register an agent and mint it to the caller", async function () {
      await registry.registerAgent(profileURI);

      expect(await registry.ownerOf(1)).to.equal(owner.address);
      expect(await registry.tokenURI(1)).to.equal(profileURI);
      expect(await registry.isActive(1)).to.equal(true);
    });

    it("Should emit AgentRegistered event", async function () {
      await expect(registry.registerAgent(profileURI))
        .to.emit(registry, "AgentRegistered")
        .withArgs(1, owner.address, profileURI);
    });

    it("Should increment agent ID across registrations from different callers", async function () {
      await registry.registerAgent(profileURI);
      await registry.connect(addr1).registerAgent("https://example.com/agents/code-reviewer.json");

      expect(await registry.nextAgentId()).to.equal(3);
      expect(await registry.ownerOf(1)).to.equal(owner.address);
      expect(await registry.ownerOf(2)).to.equal(addr1.address);
    });
  });

  describe("Agent Revocation", function () {
    const profileURI = "https://safereceipt.vercel.app/agents/rogue-agent.json";

    beforeEach(async function () {
      await registry.registerAgent(profileURI);
    });

    it("Should let the owner revoke their agent", async function () {
      await registry.revokeAgent(1);
      expect(await registry.isActive(1)).to.equal(false);
      expect(await registry.revoked(1)).to.equal(true);
    });

    it("Should emit AgentRevoked event", async function () {
      await expect(registry.revokeAgent(1)).to.emit(registry, "AgentRevoked").withArgs(1);
    });

    it("Should reject revocation from a non-owner", async function () {
      await expect(registry.connect(addr1).revokeAgent(1)).to.be.revertedWith("Not agent owner");
    });

    it("Should reject double revocation", async function () {
      await registry.revokeAgent(1);
      await expect(registry.revokeAgent(1)).to.be.revertedWith("Already revoked");
    });
  });

  describe("Edge Cases", function () {
    it("Should revert tokenURI for a non-existent agent", async function () {
      await expect(registry.tokenURI(999)).to.be.reverted;
    });
  });
});
