import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ActionRegistry } from "../typechain-types";

describe("ActionRegistry", function () {
  let actionRegistry: ActionRegistry;
  let owner: any;
  let addr1: any;

  const ON_CHAIN_APPROVE = 0;
  const OFF_CHAIN_ACTION = 2;
  const Status = { CREATED: 0, EXECUTED: 1, VERIFIED: 2, MISMATCH: 3 };

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ActionRegistry");
    actionRegistry = await Factory.deploy();
    await actionRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct initial receipt ID", async function () {
      expect(await actionRegistry.nextReceiptId()).to.equal(1);
    });
  });

  describe("Receipt Creation", function () {
    it("Should create a receipt with an agentId and track it per-agent", async function () {
      const agentId = 7;
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test intent"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test proof"));
      const riskScore = 85;

      await actionRegistry.createReceipt(agentId, ON_CHAIN_APPROVE, intentHash, proofHash, riskScore);

      const receipt = await actionRegistry.getReceipt(1);
      expect(receipt.actor).to.equal(owner.address);
      expect(receipt.agentId).to.equal(agentId);
      expect(receipt.actionType).to.equal(ON_CHAIN_APPROVE);
      expect(receipt.riskScore).to.equal(riskScore);
      expect(receipt.status).to.equal(Status.CREATED);

      const agentReceiptIds = await actionRegistry.getAgentReceipts(agentId);
      expect(agentReceiptIds.length).to.equal(1);
      expect(agentReceiptIds[0]).to.equal(1);
    });

    it("Should not track a receipt under agentId 0 (no registered identity)", async function () {
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("no agent"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("no agent proof"));

      await actionRegistry.createReceipt(0, ON_CHAIN_APPROVE, intentHash, proofHash, 10);

      expect((await actionRegistry.getAgentReceipts(0)).length).to.equal(0);
      expect((await actionRegistry.getUserReceipts(owner.address)).length).to.equal(1);
    });

    it("Should emit ReceiptCreated event", async function () {
      const agentId = 3;
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("batch intent"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("batch proof"));
      const riskScore = 45;

      await expect(
        actionRegistry.createReceipt(agentId, OFF_CHAIN_ACTION, intentHash, proofHash, riskScore)
      )
        .to.emit(actionRegistry, "ReceiptCreated")
        .withArgs(1, agentId, OFF_CHAIN_ACTION, owner.address, intentHash, proofHash, riskScore, anyValue);
    });
  });

  describe("linkExecution (on-chain path)", function () {
    let intentHash: string;
    let proofHash: string;

    beforeEach(async function () {
      intentHash = ethers.keccak256(ethers.toUtf8Bytes("approve intent"));
      proofHash = ethers.keccak256(ethers.toUtf8Bytes("approve proof"));
      await actionRegistry.createReceipt(1, ON_CHAIN_APPROVE, intentHash, proofHash, 50);
    });

    it("Should link a verified execution and store evidenceURI", async function () {
      const txHash = ethers.keccak256(ethers.toUtf8Bytes("fake tx"));
      const evidenceURI = "https://github.com/calderbuild/accountability-ledger/blob/main/1.json";

      await actionRegistry.linkExecution(1, txHash, true, evidenceURI);

      const receipt = await actionRegistry.getReceipt(1);
      expect(receipt.status).to.equal(Status.VERIFIED);
      expect(receipt.outcomeHash).to.equal(txHash);
      expect(receipt.evidenceURI).to.equal(evidenceURI);
    });

    it("Should mark MISMATCH when verified is false", async function () {
      const txHash = ethers.keccak256(ethers.toUtf8Bytes("mismatched tx"));
      await actionRegistry.linkExecution(1, txHash, false, "");

      const receipt = await actionRegistry.getReceipt(1);
      expect(receipt.status).to.equal(Status.MISMATCH);
    });

    it("Should reject linking from a non-owner", async function () {
      const txHash = ethers.keccak256(ethers.toUtf8Bytes("tx"));
      await expect(
        actionRegistry.connect(addr1).linkExecution(1, txHash, true, "")
      ).to.be.revertedWith("Not receipt owner");
    });

    it("Should reject double-linking", async function () {
      const txHash = ethers.keccak256(ethers.toUtf8Bytes("tx"));
      await actionRegistry.linkExecution(1, txHash, true, "");
      await expect(actionRegistry.linkExecution(1, txHash, true, "")).to.be.revertedWith("Already linked");
    });
  });

  describe("linkOffChainOutcome (off-chain commit-reveal path)", function () {
    let intentHash: string;
    let proofHash: string;

    beforeEach(async function () {
      intentHash = ethers.keccak256(ethers.toUtf8Bytes("off-chain intent"));
      proofHash = ethers.keccak256(ethers.toUtf8Bytes("off-chain proof"));
      await actionRegistry.createReceipt(2, OFF_CHAIN_ACTION, intentHash, proofHash, 20);
    });

    it("Should link a verified off-chain outcome with a trace evidenceURI", async function () {
      const outcomeHash = ethers.keccak256(ethers.toUtf8Bytes("trace json contents"));
      const evidenceURI = "https://github.com/calderbuild/accountability-ledger/blob/main/traces/1.json";

      await actionRegistry.linkOffChainOutcome(1, outcomeHash, true, evidenceURI);

      const receipt = await actionRegistry.getReceipt(1);
      expect(receipt.status).to.equal(Status.VERIFIED);
      expect(receipt.outcomeHash).to.equal(outcomeHash);
      expect(receipt.evidenceURI).to.equal(evidenceURI);
    });

    it("Should emit OutcomeLinked with the receipt's agentId", async function () {
      const outcomeHash = ethers.keccak256(ethers.toUtf8Bytes("trace"));
      const evidenceURI = "https://example.com/trace.json";

      await expect(actionRegistry.linkOffChainOutcome(1, outcomeHash, true, evidenceURI))
        .to.emit(actionRegistry, "OutcomeLinked")
        .withArgs(1, 2, Status.VERIFIED, outcomeHash, evidenceURI);
    });
  });
});
