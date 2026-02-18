import { useState, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { DEMO_SCENARIOS } from '../lib/demoScenarios';
import { runAgentDemo } from '../lib/agentRunner';
import type { AgentStep, AgentDemoResult } from '../lib/agentRunner';
import type { DemoScenario } from '../lib/demoScenarios';

// Icons
const PlayIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

function StepIndicator({ status }: { status: AgentStep['status'] }) {
  switch (status) {
    case 'done':
      return (
        <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
          <CheckIcon />
        </div>
      );
    case 'running':
      return (
        <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
          <SpinnerIcon />
        </div>
      );
    case 'error':
      return (
        <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
          <XIcon />
        </div>
      );
    default:
      return (
        <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10" />
      );
  }
}

function getRiskBadge(detail: string | undefined) {
  if (!detail) return null;
  if (detail.includes('HIGH')) return 'text-red-400';
  if (detail.includes('MEDIUM')) return 'text-amber-400';
  if (detail.includes('LOW')) return 'text-emerald-400';
  return 'text-white';
}

export function AgentDemo() {
  const { address, isConnected, signer } = useWallet();
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AgentDemoResult | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario | null>(null);

  const handleRun = useCallback(async (scenario: DemoScenario) => {
    if (!signer || !address) return;

    setSelectedScenario(scenario);
    setIsRunning(true);
    setResult(null);

    const demoResult = await runAgentDemo(
      scenario,
      signer,
      address,
      (updatedSteps) => setSteps([...updatedSteps])
    );

    setResult(demoResult);
    setIsRunning(false);
  }, [signer, address]);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <PlayIcon />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Agent Verification Demo</h2>
          <p className="text-slate-400 text-sm">See how on-chain receipts detect when an agent tampers with your transaction</p>
        </div>
      </div>

      {/* Scenario Selection */}
      {!isRunning && !result && (
        <>
          {!isConnected ? (
            <div>
              <div className="space-y-3 opacity-60 pointer-events-none">
                {DEMO_SCENARIOS.map(scenario => (
                  <div
                    key={scenario.id}
                    className={`w-full text-left p-4 rounded-lg bg-white/5 border ${
                      scenario.expectedOutcome === 'MISMATCH'
                        ? 'border-red-500/30'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-white font-medium">{scenario.label}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        scenario.expectedRiskLevel === 'HIGH'
                          ? 'bg-red-500/20 text-red-400'
                          : scenario.expectedRiskLevel === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {scenario.expectedRiskLevel}
                      </span>
                      {scenario.expectedOutcome === 'MISMATCH' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                          MISMATCH
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm">{scenario.description}</p>
                  </div>
                ))}
              </div>
              <p className="text-slate-400 text-sm mt-4 text-center">Connect your wallet to run the demo</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm mb-4">
                Select a scenario. The agent will automatically: parse intent, analyze risk, create receipt, execute transaction, and verify execution.
              </p>
              {DEMO_SCENARIOS.map(scenario => (
                <button
                  key={scenario.id}
                  onClick={() => handleRun(scenario)}
                  className={`w-full text-left p-4 rounded-lg bg-white/5 border transition-all group cursor-pointer ${
                    scenario.expectedOutcome === 'MISMATCH'
                      ? 'border-red-500/30 hover:bg-red-500/5 hover:border-red-500/50'
                      : 'border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-white font-medium">{scenario.label}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          scenario.expectedRiskLevel === 'HIGH'
                            ? 'bg-red-500/20 text-red-400'
                            : scenario.expectedRiskLevel === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {scenario.expectedRiskLevel}
                        </span>
                        {scenario.expectedOutcome === 'MISMATCH' && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                            MISMATCH
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-sm">{scenario.description}</p>
                    </div>
                    <div className="text-slate-500 group-hover:text-white transition-colors">
                      <PlayIcon />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Step Progress */}
      {steps.length > 0 && (
        <div className="space-y-1 mb-6">
          {selectedScenario && (
            <div className="mb-4 px-3 py-2 bg-white/5 rounded-lg">
              <span className="text-slate-400 text-xs">Scenario: </span>
              <span className="text-white text-sm">{selectedScenario.label}</span>
            </div>
          )}
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-start space-x-3 py-2">
              <div className="flex flex-col items-center">
                <StepIndicator status={step.status} />
                {i < steps.length - 1 && (
                  <div className={`w-px h-6 mt-1 ${
                    step.status === 'done' ? 'bg-emerald-500/30' : 'bg-white/10'
                  }`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  step.status === 'done' ? 'text-white' :
                  step.status === 'running' ? 'text-blue-400' :
                  step.status === 'error' ? 'text-red-400' :
                  'text-slate-500'
                }`}>
                  {step.label}
                </p>
                {step.detail && (
                  <p className={`text-xs mt-0.5 font-mono ${
                    step.status === 'error' ? 'text-red-400/80' :
                    getRiskBadge(step.detail) || 'text-slate-500'
                  }`}>
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result Summary */}
      {result && (
        <div className={`p-4 rounded-lg ${
          result.success && result.verified
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : 'bg-red-500/10 border border-red-500/30'
        }`}>
          {result.success ? (
            <div>
              <p className={`${result.verified ? 'text-emerald-400' : 'text-red-400'} font-medium mb-2`}>
                {result.verified ? 'Execution Verified' : 'Execution Mismatch Detected'}
              </p>
              <div className="space-y-1 text-sm">
                <p className="text-slate-400">
                  Receipt: <span className="text-white font-mono">#{result.receiptId}</span>
                </p>
                <p className="text-slate-400">
                  Risk Score: <span className="text-white">{result.riskScore}/100</span>
                </p>
                <p className="text-slate-400">
                  Tx: <a
                    href={`https://sepolia.basescan.org/tx/${result.executionTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 font-mono underline"
                  >{result.executionTxHash?.slice(0, 14)}...</a>
                </p>
                <p className="text-slate-400">
                  Status: <span className={result.verified ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {result.verified ? 'VERIFIED' : 'MISMATCH'}
                  </span>
                </p>
                {result.mismatchDetail && (
                  <p className="text-red-400/80 text-xs mt-2 font-mono bg-red-500/5 px-2 py-1 rounded">
                    {result.mismatchDetail}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-red-400">{result.error}</p>
          )}

          <button
            onClick={() => { setResult(null); setSteps([]); setSelectedScenario(null); }}
            className="mt-4 btn-secondary text-sm"
          >
            Run Another Scenario
          </button>
        </div>
      )}
    </div>
  );
}
