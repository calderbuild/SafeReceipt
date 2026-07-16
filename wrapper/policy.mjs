/**
 * PolicyEngine -- post-execution deviation scoring for off-chain agent actions.
 *
 * Scoring architecture is ported from the shape of
 *   openclaw-surge-hackathon/backend/scanner.py  (RULES -> severity weights -> score)
 *   frontend/src/lib/riskEngine.ts               (weighted rules -> risk level)
 * but the rules themselves are new: they score a runtime action TRACE against the
 * declared intent, not a static skill/approve definition.
 *
 * verified = no critical/high rule fired (i.e. the agent stayed within what it
 * declared). A MISMATCH is an agent that overran its declared scope or budget.
 */

const SEVERITY_WEIGHT = { critical: 30, high: 15, medium: 5, low: 1 };

const RULES = [
  {
    id: "EMPTY_TRACE",
    severity: "high",
    test: (trace) => (trace.events?.length ?? 0) === 0,
    message: "Agent produced no execution events despite committing an intent.",
  },
  {
    id: "SCOPE_CREEP",
    severity: "high",
    test: (trace) => {
      const declared = new Set((trace.declaredIntent?.declaredScope ?? []).map(String));
      if (declared.size === 0) return false;
      const touched = (trace.events ?? [])
        .flatMap((e) => (e.data?.touched ? [].concat(e.data.touched) : []))
        .map(String);
      return touched.some((t) => !declared.has(t));
    },
    message: "Agent touched a resource outside its declared scope.",
    detail: (trace) => {
      const declared = new Set((trace.declaredIntent?.declaredScope ?? []).map(String));
      const touched = (trace.events ?? [])
        .flatMap((e) => (e.data?.touched ? [].concat(e.data.touched) : []))
        .map(String);
      return { outOfScope: touched.filter((t) => !declared.has(t)) };
    },
  },
  {
    id: "BUDGET_OVERRUN",
    severity: "medium",
    test: (trace) => {
      const budget = trace.declaredIntent?.budgetMs;
      return typeof budget === "number" && trace.durationMs > budget;
    },
    message: "Agent exceeded its declared time budget.",
    detail: (trace) => ({ budgetMs: trace.declaredIntent?.budgetMs, actualMs: trace.durationMs }),
  },
  {
    id: "ERROR_STAGE",
    severity: "medium",
    test: (trace) => (trace.events ?? []).some((e) => e.stage === "error" || e.data?.error),
    message: "Agent trace contains an error event.",
  },
];

export function evaluatePolicy(trace) {
  const triggered = [];
  let penalty = 0;

  for (const rule of RULES) {
    if (rule.test(trace)) {
      const entry = {
        id: rule.id,
        severity: rule.severity,
        message: rule.message,
        ...(rule.detail ? { detail: rule.detail(trace) } : {}),
      };
      triggered.push(entry);
      penalty += SEVERITY_WEIGHT[rule.severity] ?? 0;
    }
  }

  const score = Math.max(0, 100 - penalty);
  const hasBlocking = triggered.some((t) => t.severity === "critical" || t.severity === "high");

  return {
    score,
    verified: !hasBlocking,
    rulesTriggered: triggered.map((t) => t.id).sort(),
    findings: triggered,
    riskLevel: score >= 80 ? "low" : score >= 50 ? "medium" : "high",
  };
}
