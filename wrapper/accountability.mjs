import { ethers } from "ethers";
import { ACTION_REGISTRY_ABI, ACTION_TYPE, DEPLOYMENTS, STATUS } from "./abi.mjs";
import { hashIntent, hashTrace } from "./canonicalize.mjs";

/**
 * AccountabilityClient wraps a single unit of agent work in the commit-reveal
 * flow against ActionRegistry.sol:
 *
 *   beginAction()  -> hash the declared intent, createReceipt() on-chain (CREATED)
 *   emit()         -> append a PipelineEvent to the local trace buffer
 *   endAction()    -> hash the full trace, hand back the trace + outcomeHash so the
 *                     caller can publish it to a public evidenceURI, then
 *                     linkOffChainOutcome() flips the receipt to VERIFIED / MISMATCH
 *
 * PipelineEvent shape is ported from agentcut/backend/pipeline.py:
 *   { stage, message, progress, data, timestamp }  (+ duration on the final event)
 *
 * Trust boundary (see accountability-ledger README): the chain timestamps the
 * result immutably; it does not attest that the trace is a truthful account of
 * what the agent did. `verified` is computed off-chain by the PolicyEngine.
 */
export class AccountabilityClient {
  constructor({ network = "monad", signer, evidenceBaseURL }) {
    this.cfg = DEPLOYMENTS[network];
    if (!this.cfg) throw new Error(`Unknown network: ${network}`);
    this.contract = new ethers.Contract(this.cfg.actionRegistry, ACTION_REGISTRY_ABI, signer);
    // Public base URL where the caller will publish traces/{receiptId}.json.
    this.evidenceBaseURL = evidenceBaseURL;
    this._reset();
  }

  _reset() {
    this.events = [];
    this.receiptId = null;
    this.intent = null;
    this.agentId = null;
    this.startedAt = null;
  }

  emit(stage, message, progress = 0, data = null) {
    this.events.push({
      stage,
      message,
      progress,
      data,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * Commit the declared intent on-chain BEFORE the agent runs.
   * @returns { receiptId, intentHash, txHash }
   */
  async beginAction({ agentId, declaredIntent, riskScore = 0 }) {
    this._reset();
    this.agentId = agentId;
    this.intent = declaredIntent;
    this.startedAt = Date.now();

    const intentHash = hashIntent(declaredIntent);
    // proofHash of the intent envelope; the full-trace hash is computed at endAction.
    const proofHash = hashTrace({ agentId, declaredIntent, committedAt: Math.floor(this.startedAt / 1000) });

    const tx = await this.contract.createReceipt(
      agentId,
      ACTION_TYPE.OFF_CHAIN_ACTION,
      intentHash,
      proofHash,
      riskScore,
    );
    const rcpt = await tx.wait();

    // Parse the receiptId out of the ReceiptCreated event.
    const created = rcpt.logs
      .map((l) => {
        try { return this.contract.interface.parseLog(l); } catch { return null; }
      })
      .find((p) => p && p.name === "ReceiptCreated");
    this.receiptId = created ? Number(created.args.receiptId) : Number(await this.contract.nextReceiptId()) - 1;

    this.emit("commit", `Intent committed on-chain as receipt #${this.receiptId}`, 0, { intentHash });
    return { receiptId: this.receiptId, intentHash, txHash: tx.hash };
  }

  /**
   * Build the full trace object (the pre-image published to the evidenceURI).
   */
  buildTrace(policyResult) {
    return {
      version: "1.0",
      schema: "safereceipt-offchain-trace/1.0",
      receiptId: this.receiptId,
      agentId: this.agentId,
      actionType: "OFF_CHAIN_ACTION",
      chainId: this.cfg.chainId,
      declaredIntent: this.intent,
      events: this.events,
      durationMs: Date.now() - this.startedAt,
      policy: policyResult,
      createdAt: Math.floor(this.startedAt / 1000),
    };
  }

  /**
   * Reveal: hash the trace, link the outcome on-chain.
   * The caller must publish `trace` to `${evidenceBaseURL}/${receiptId}.json`
   * (returned here) so the evidenceURI resolves. `verified` comes from the
   * PolicyEngine result.
   * @returns { trace, outcomeHash, evidenceURI, verified, txHash }
   */
  async endAction({ policyResult }) {
    if (this.receiptId == null) throw new Error("beginAction() not called");

    const trace = this.buildTrace(policyResult);
    const outcomeHash = hashTrace(trace);
    const evidenceURI = `${this.evidenceBaseURL}/${this.receiptId}.json`;
    const verified = policyResult.verified === true;

    const tx = await this.contract.linkOffChainOutcome(this.receiptId, outcomeHash, verified, evidenceURI);
    await tx.wait();

    const receipt = await this.contract.getReceipt(this.receiptId);
    return {
      trace,
      outcomeHash,
      evidenceURI,
      verified,
      status: STATUS[Number(receipt.status)],
      txHash: tx.hash,
    };
  }
}
