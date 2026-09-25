import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ReceiptRegistry } from "../typechain-types";

describe("ReceiptRegistry", function () {
  let receiptRegistry: ReceiptRegistry;
  let owner: any;
  let addr1: any;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const ReceiptRegistryFactory = await ethers.getContractFactory("ReceiptRegistry");
    receiptRegistry = await ReceiptRegistryFactory.deploy();
    await receiptRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct initial receipt ID", async function () {
      expect(await receiptRegistry.nextReceiptId()).to.equal(1);
    });
  });

  describe("Receipt Creation", function () {
    it("Should create a receipt successfully", async function () {
      const actionType = 1; // APPROVE
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("test intent"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("test proof"));
      const riskScore = 85;

      const tx = await receiptRegistry.createReceipt(
        actionType,
        intentHash,
        proofHash,
        riskScore
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // Check receipt was stored
      const storedReceipt = await receiptRegistry.getReceipt(1);
      expect(storedReceipt.actor).to.equal(owner.address);
      expect(storedReceipt.actionType).to.equal(actionType);
      expect(storedReceipt.riskScore).to.equal(riskScore);
      expect(storedReceipt.intentHash).to.equal(intentHash);
      expect(storedReceipt.proofHash).to.equal(proofHash);
    });

    it("Should emit ReceiptCreated event", async function () {
      const actionType = 2; // BATCH_PAY
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("batch intent"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("batch proof"));
      const riskScore = 45;

      await expect(
        receiptRegistry.createReceipt(actionType, intentHash, proofHash, riskScore)
      )
        .to.emit(receiptRegistry, "ReceiptCreated")
        .withArgs(1, owner.address, actionType, intentHash, proofHash, riskScore, anyValue);
    });

    it("Should increment receipt ID", async function () {
      const actionType = 1;
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent1"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof1"));
      const riskScore = 30;

      await receiptRegistry.createReceipt(actionType, intentHash, proofHash, riskScore);
      expect(await receiptRegistry.nextReceiptId()).to.equal(2);

      await receiptRegistry.createReceipt(actionType, intentHash, proofHash, riskScore);
      expect(await receiptRegistry.nextReceiptId()).to.equal(3);
    });
  });

  describe("User Receipts", function () {
    it("Should track user receipts correctly", async function () {
      const actionType = 1;
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("intent"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
      const riskScore = 60;

      // Create receipt with owner
      await receiptRegistry.createReceipt(actionType, intentHash, proofHash, riskScore);
      
      // Create receipt with addr1
      await receiptRegistry.connect(addr1).createReceipt(actionType, intentHash, proofHash, riskScore);
      
      // Create another receipt with owner
      await receiptRegistry.createReceipt(actionType, intentHash, proofHash, riskScore);

      const ownerReceipts = await receiptRegistry.getUserReceipts(owner.address);
      const addr1Receipts = await receiptRegistry.getUserReceipts(addr1.address);

      expect(ownerReceipts.length).to.equal(2);
      expect(ownerReceipts[0]).to.equal(1);
      expect(ownerReceipts[1]).to.equal(3);
      
      expect(addr1Receipts.length).to.equal(1);
      expect(addr1Receipts[0]).to.equal(2);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle maximum risk score", async function () {
      const actionType = 1;
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("max risk"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("max proof"));
      const riskScore = 100;

      await receiptRegistry.createReceipt(actionType, intentHash, proofHash, riskScore);
      
      const receipt = await receiptRegistry.getReceipt(1);
      expect(receipt.riskScore).to.equal(100);
    });

    it("Should handle zero risk score", async function () {
      const actionType = 2;
      const intentHash = ethers.keccak256(ethers.toUtf8Bytes("zero risk"));
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("zero proof"));
      const riskScore = 0;

      await receiptRegistry.createReceipt(actionType, intentHash, proofHash, riskScore);
      
      const receipt = await receiptRegistry.getReceipt(1);
      expect(receipt.riskScore).to.equal(0);
    });
  });

  describe("linkExecution", function () {
    const Status = { CREATED: 0, EXECUTED: 1, VERIFIED: 2, MISMATCH: 3 };
    const h = (x: string) => ethers.keccak256(ethers.toUtf8Bytes(x));

    beforeEach(async function () {
      await receiptRegistry.createReceipt(1, h("intent"), h("proof"), 40);
    });

    it("Should mark VERIFIED and store the tx hash", async function () {
      await receiptRegistry.linkExecution(1, h("tx"), true);
      const receipt = await receiptRegistry.getReceipt(1);
      expect(receipt.status).to.equal(Status.VERIFIED);
      expect(receipt.txHash).to.equal(h("tx"));
    });

    it("Should mark MISMATCH when verified is false", async function () {
      await receiptRegistry.linkExecution(1, h("tx"), false);
      expect((await receiptRegistry.getReceipt(1)).status).to.equal(Status.MISMATCH);
    });

    it("Should emit ExecutionLinked", async function () {
      await expect(receiptRegistry.linkExecution(1, h("tx"), true))
        .to.emit(receiptRegistry, "ExecutionLinked")
        .withArgs(1, h("tx"), Status.VERIFIED);
    });

    it("Should reject linking from a non-owner", async function () {
      await expect(receiptRegistry.connect(addr1).linkExecution(1, h("tx"), true)).to.be.revertedWith(
        "Not receipt owner"
      );
    });

    it("Should reject double-linking", async function () {
      await receiptRegistry.linkExecution(1, h("tx"), true);
      await expect(receiptRegistry.linkExecution(1, h("tx"), false)).to.be.revertedWith("Already linked");
    });

    it("Should reject a receipt that does not exist", async function () {
      await expect(receiptRegistry.linkExecution(42, h("tx"), true)).to.be.revertedWith("Not receipt owner");
    });
  });
});
