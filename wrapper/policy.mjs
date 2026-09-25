/**
 * PolicyEngine -- post-execution deviation scoring for off-chain agent actions.
 *
 * Scoring architecture is ported from the shape of
 *   openclaw-surge-hackathon/backend/scanner.py  (RULES -> severity weights -> score)
 *   frontend/src/lib/riskEngine.ts               (weighted rules -> risk level)
 * but the rules themselves are new: they score a runtime action TRACE against the
 * declared intent, not a static skill/approve definition.
 *
 * verified = no critical/high rule fired: the agent stayed within its declared
 * scope and did not error. Going over the time budget is recorded (medium) but
 * does not flip the outcome on its own. The frontend re-runs these same rules
 * on the published trace (frontend/src/lib/tracePolicy.ts); keep them in sync.
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
    test: (trace) => outOfScope(trace).length > 0,
    message: "Agent touched a resource outside its declared scope.",
    detail: (trace) => ({ outOfScope: outOfScope(trace) }),
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
    severity: "high",
    test: (trace) => (trace.events ?? []).some((e) => e.stage === "error" || e.data?.error),
    message: "Agent trace contains an error event.",
  },
];

// A touched path is in scope when it starts with one of the declared prefixes
// ("docs/" covers "docs/a.md"). `touched` is reported by the harness itself.
function outOfScope(trace) {
  const declared = (trace.declaredIntent?.declaredScope ?? []).map(String);
  if (declared.length === 0) return [];
  return (trace.events ?? [])
    .flatMap((e) => (e.data?.touched ? [].concat(e.data.touched) : []))
    .map(String)
    .filter((t) => !declared.some((d) => t.startsWith(d)));
}

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
