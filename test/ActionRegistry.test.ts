import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ActionRegistry, AgentIdentityRegistry } from "../typechain-types";

describe("ActionRegistry", function () {
  let actionRegistry: ActionRegistry;
  let identity: AgentIdentityRegistry;
  let owner: any;
  let addr1: any;

  const ON_CHAIN_APPROVE = 0;
  const OFF_CHAIN_ACTION = 2;
  const Status = { CREATED: 0, EXECUTED: 1, VERIFIED: 2, MISMATCH: 3 };
  const h = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    identity = await (await ethers.getContractFactory("AgentIdentityRegistry")).deploy();
    await identity.waitForDeployment();
    // owner holds agents #1 and #2, addr1 holds agent #3
    await identity.registerAgent("ipfs://agent-1");
    await identity.registerAgent("ipfs://agent-2");
    await identity.connect(addr1).registerAgent("ipfs://agent-3");

    const Factory = await ethers.getContractFactory("ActionRegistry");
    actionRegistry = await Factory.deploy(await identity.getAddress());
    await actionRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct initial receipt ID and identity registry", async function () {
      expect(await actionRegistry.nextReceiptId()).to.equal(1);
      expect(await actionRegistry.identity()).to.equal(await identity.getAddress());
    });

    it("Should reject a zero identity registry", async function () {
      const Factory = await ethers.getContractFactory("ActionRegistry");
      await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWith("Identity registry required");
    });
  });

  describe("Receipt Creation", function () {
    it("Should create a receipt with an agentId and track it per-agent", async function () {
      await actionRegistry.createReceipt(1, ON_CHAIN_APPROVE, h("test intent"), h("test proof"), 85);

      const receipt = await actionRegistry.getReceipt(1);
      expect(receipt.actor).to.equal(owner.address);
      expect(receipt.agentId).to.equal(1);
      expect(receipt.actionType).to.equal(ON_CHAIN_APPROVE);
      expect(receipt.riskScore).to.equal(85);
      expect(receipt.status).to.equal(Status.CREATED);

      const agentReceiptIds = await actionRegistry.getAgentReceipts(1);
      expect(agentReceiptIds.length).to.equal(1);
      expect(agentReceiptIds[0]).to.equal(1);
    });

    it("Should not track a receipt under agentId 0 (no registered identity)", async function () {
      await actionRegistry.createReceipt(0, ON_CHAIN_APPROVE, h("no agent"), h("no agent proof"), 10);

      expect((await actionRegistry.getAgentReceipts(0)).length).to.equal(0);
      expect((await actionRegistry.getUserReceipts(owner.address)).length).to.equal(1);
    });

    it("Should emit ReceiptCreated event", async function () {
      await expect(actionRegistry.createReceipt(2, OFF_CHAIN_ACTION, h("i"), h("p"), 45))
        .to.emit(actionRegistry, "ReceiptCreated")
        .withArgs(1, 2, OFF_CHAIN_ACTION, owner.address, h("i"), h("p"), 45, anyValue);
    });

    it("Should reject a receipt filed under someone else's agent", async function () {
      await expect(
        actionRegistry.createReceipt(3, OFF_CHAIN_ACTION, h("i"), h("p"), 10)
      ).to.be.revertedWith("Not agent owner");
    });

    it("Should reject a receipt for an agent that was never registered", async function () {
      await expect(actionRegistry.createReceipt(99, OFF_CHAIN_ACTION, h("i"), h("p"), 10)).to.be.reverted;
    });

    it("Should reject a receipt from a revoked agent", async function () {
      await identity.revokeAgent(1);
      await expect(
        actionRegistry.createReceipt(1, OFF_CHAIN_ACTION, h("i"), h("p"), 10)
      ).to.be.revertedWith("Agent revoked");
    });

    it("Should follow the agent to its new owner after a transfer", async function () {
      await identity.transferFrom(owner.address, addr1.address, 1);
      await expect(
        actionRegistry.createReceipt(1, OFF_CHAIN_ACTION, h("i"), h("p"), 10)
      ).to.be.revertedWith("Not agent owner");
      await actionRegistry.connect(addr1).createReceipt(1, OFF_CHAIN_ACTION, h("i"), h("p"), 10);
      expect((await actionRegistry.getReceipt(1)).actor).to.equal(addr1.address);
    });

    it("Should reject an unknown action type", async function () {
      await expect(actionRegistry.createReceipt(1, 3, h("i"), h("p"), 10)).to.be.revertedWith(
        "Unknown action type"
      );
    });

    it("Should reject a risk score above 100", async function () {
      await actionRegistry.createReceipt(1, ON_CHAIN_APPROVE, h("i"), h("p"), 100);
      await expect(actionRegistry.createReceipt(1, ON_CHAIN_APPROVE, h("i"), h("p"), 101)).to.be.revertedWith(
        "Risk score out of range"
      );
    });
  });

  describe("linkExecution (on-chain path)", function () {
    beforeEach(async function () {
      await actionRegistry.createReceipt(1, ON_CHAIN_APPROVE, h("approve intent"), h("approve proof"), 50);
    });

    it("Should link a verified execution and store evidenceURI", async function () {
      const evidenceURI = "https://github.com/calderbuild/accountability-ledger/blob/master/1.json";
      await actionRegistry.linkExecution(1, h("fake tx"), true, evidenceURI);

      const receipt = await actionRegistry.getReceipt(1);
      expect(receipt.status).to.equal(Status.VERIFIED);
      expect(receipt.outcomeHash).to.equal(h("fake tx"));
      expect(receipt.evidenceURI).to.equal(evidenceURI);
    });

    it("Should mark MISMATCH when verified is false", async function () {
      await actionRegistry.linkExecution(1, h("mismatched tx"), false, "");
      expect((await actionRegistry.getReceipt(1)).status).to.equal(Status.MISMATCH);
    });

    it("Should emit OutcomeLinked from the on-chain path", async function () {
      await expect(actionRegistry.linkExecution(1, h("tx"), true, ""))
        .to.emit(actionRegistry, "OutcomeLinked")
        .withArgs(1, 1, Status.VERIFIED, h("tx"), "");
    });

    it("Should reject linking from a non-owner", async function () {
      await expect(actionRegistry.connect(addr1).linkExecution(1, h("tx"), true, "")).to.be.revertedWith(
        "Not receipt owner"
      );
    });

    it("Should reject double-linking", async function () {
      await actionRegistry.linkExecution(1, h("tx"), true, "");
      await expect(actionRegistry.linkExecution(1, h("tx"), true, "")).to.be.revertedWith("Already linked");
    });

    it("Should reject an empty tx hash", async function () {
      await expect(actionRegistry.linkExecution(1, ethers.ZeroHash, true, "")).to.be.revertedWith("Empty tx hash");
    });

    it("Should reject linking a receipt that does not exist", async function () {
      await expect(actionRegistry.linkExecution(999, h("tx"), true, "")).to.be.revertedWith("Not receipt owner");
    });

    it("Should reject the off-chain link function on an on-chain receipt", async function () {
      await expect(actionRegistry.linkOffChainOutcome(1, h("trace"), true, "https://x/1.json")).to.be.revertedWith(
        "Use linkExecution"
      );
    });
  });

  describe("linkOffChainOutcome (off-chain commit-reveal path)", function () {
    const evidenceURI = "https://github.com/calderbuild/accountability-ledger/blob/master/traces/1.json";

    beforeEach(async function () {
      await actionRegistry.createReceipt(2, OFF_CHAIN_ACTION, h("off-chain intent"), h("off-chain proof"), 20);
    });

    it("Should link a verified off-chain outcome with a trace evidenceURI", async function () {
      await actionRegistry.linkOffChainOutcome(1, h("trace json contents"), true, evidenceURI);

      const receipt = await actionRegistry.getReceipt(1);
      expect(receipt.status).to.equal(Status.VERIFIED);
      expect(receipt.outcomeHash).to.equal(h("trace json contents"));
      expect(receipt.evidenceURI).to.equal(evidenceURI);
    });

    it("Should mark MISMATCH when verified is false", async function () {
      await actionRegistry.linkOffChainOutcome(1, h("trace"), false, evidenceURI);
      expect((await actionRegistry.getReceipt(1)).status).to.equal(Status.MISMATCH);
    });

    it("Should emit OutcomeLinked with the receipt's agentId", async function () {
      await expect(actionRegistry.linkOffChainOutcome(1, h("trace"), true, evidenceURI))
        .to.emit(actionRegistry, "OutcomeLinked")
        .withArgs(1, 2, Status.VERIFIED, h("trace"), evidenceURI);
    });

    it("Should reject linking from a non-owner", async function () {
      await expect(
        actionRegistry.connect(addr1).linkOffChainOutcome(1, h("trace"), true, evidenceURI)
      ).to.be.revertedWith("Not receipt owner");
    });

    it("Should reject double-linking", async function () {
      await actionRegistry.linkOffChainOutcome(1, h("trace"), true, evidenceURI);
      await expect(actionRegistry.linkOffChainOutcome(1, h("trace"), true, evidenceURI)).to.be.revertedWith(
        "Already linked"
      );
    });

    it("Should reject an empty outcome hash", async function () {
      await expect(actionRegistry.linkOffChainOutcome(1, ethers.ZeroHash, true, evidenceURI)).to.be.revertedWith(
        "Empty outcome hash"
      );
    });

    it("Should reject an empty evidence URI", async function () {
      await expect(actionRegistry.linkOffChainOutcome(1, h("trace"), true, "")).to.be.revertedWith(
        "Evidence URI required"
      );
    });

    it("Should reject the on-chain link function on an off-chain receipt", async function () {
      await expect(actionRegistry.linkExecution(1, h("tx"), true, "")).to.be.revertedWith("Use linkOffChainOutcome");
    });
  });

  describe("Receipt lists", function () {
    it("Should keep receipts separate per user", async function () {
      await actionRegistry.createReceipt(1, OFF_CHAIN_ACTION, h("a"), h("a"), 1);
      await actionRegistry.connect(addr1).createReceipt(3, OFF_CHAIN_ACTION, h("b"), h("b"), 1);
      await actionRegistry.createReceipt(0, ON_CHAIN_APPROVE, h("c"), h("c"), 1);

      expect((await actionRegistry.getUserReceipts(owner.address)).map(Number)).to.deep.equal([1, 3]);
      expect((await actionRegistry.getUserReceipts(addr1.address)).map(Number)).to.deep.equal([2]);
      expect((await actionRegistry.getAgentReceipts(3)).map(Number)).to.deep.equal([2]);
    });
  });
});
