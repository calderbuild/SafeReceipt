/**
 * Browser port of wrapper/policy.mjs. The Fleet page re-runs these rules on a
 * published trace, so the stamp is recomputed here instead of taken from the
 * chain. Keep the rules identical to the wrapper's.
 */

type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface TraceEvent {
  stage?: string;
  data?: { touched?: string | string[]; error?: unknown } | null;
}

export interface OffChainTrace {
  declaredIntent?: { declaredScope?: string[]; budgetMs?: number };
  events?: TraceEvent[];
  durationMs?: number;
}

export interface PolicyVerdict {
  verified: boolean;
  score: number;
  rulesTriggered: string[];
  outOfScope: string[];
}

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 30, high: 15, medium: 5, low: 1 };

function outOfScope(trace: OffChainTrace): string[] {
  const declared = (trace.declaredIntent?.declaredScope ?? []).map(String);
  if (declared.length === 0) return [];
  return (trace.events ?? [])
    .flatMap((e) => (e.data?.touched ? ([] as string[]).concat(e.data.touched) : []))
    .map(String)
    .filter((t) => !declared.some((d) => t.startsWith(d)));
}

const RULES: { id: string; severity: Severity; test: (t: OffChainTrace) => boolean }[] = [
  { id: 'EMPTY_TRACE', severity: 'high', test: (t) => (t.events?.length ?? 0) === 0 },
  { id: 'SCOPE_CREEP', severity: 'high', test: (t) => outOfScope(t).length > 0 },
  {
    id: 'BUDGET_OVERRUN',
    severity: 'medium',
    test: (t) => typeof t.declaredIntent?.budgetMs === 'number' && (t.durationMs ?? 0) > t.declaredIntent.budgetMs,
  },
  { id: 'ERROR_STAGE', severity: 'high', test: (t) => (t.events ?? []).some((e) => e.stage === 'error' || !!e.data?.error) },
];

export function evaluateTrace(trace: OffChainTrace): PolicyVerdict {
  const fired = RULES.filter((r) => r.test(trace));
  const penalty = fired.reduce((sum, r) => sum + SEVERITY_WEIGHT[r.severity], 0);
  return {
    verified: !fired.some((r) => r.severity === 'critical' || r.severity === 'high'),
    score: Math.max(0, 100 - penalty),
    rulesTriggered: fired.map((r) => r.id).sort(),
    outOfScope: outOfScope(trace),
  };
}
