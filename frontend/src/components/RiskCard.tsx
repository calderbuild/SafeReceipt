import React, { useState } from 'react';
import type { RiskResult, RuleDetail } from '../lib/riskEngine';

interface RiskCardProps {
  result: RiskResult;
  aiExplanation?: string | null;
  className?: string;
}

const getRiskLevel = (score: number): { label: string; color: string; bgColor: string; borderColor: string } => {
  if (score >= 50) {
    return {
      label: 'High Risk',
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
    };
  }
  if (score >= 25) {
    return {
      label: 'Medium Risk',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30',
    };
  }
  return {
    label: 'Low Risk',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
  };
};

const RuleItem: React.FC<{ rule: RuleDetail; expanded: boolean; onToggle: () => void }> = ({
  rule,
  expanded,
  onToggle,
}) => {
  if (!rule.triggered) return null;

  return (
    <div
      className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
            rule.weight >= 25 ? 'bg-red-500/20 text-red-400' :
            rule.weight >= 10 ? 'bg-amber-500/20 text-amber-400' :
            'bg-emerald-500/20 text-emerald-400'
          }`}>
            +{rule.weight}
          </div>
          <code className="text-sm text-white font-mono">{rule.ruleName}</code>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-sm text-slate-400">{rule.description}</p>
          {rule.recommendation && (
            <p className="text-xs text-slate-500 mt-2 flex items-start space-x-1">
              <span className="text-amber-400">Suggestion:</span>
              <span>{rule.recommendation}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const RiskCard: React.FC<RiskCardProps> = ({ result, aiExplanation, className = '' }) => {
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const riskLevel = getRiskLevel(result.riskScore);
  const triggeredRules = result.ruleDetails.filter(r => r.triggered);

  const toggleRule = (ruleName: string) => {
    const newSet = new Set(expandedRules);
    if (newSet.has(ruleName)) {
      newSet.delete(ruleName);
    } else {
      newSet.add(ruleName);
    }
    setExpandedRules(newSet);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Risk Score Header */}
      <div className={`p-5 rounded-2xl border ${riskLevel.bgColor} ${riskLevel.borderColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">Risk Score</p>
            <div className="flex items-baseline space-x-2">
              <span className={`text-4xl font-bold font-display ${riskLevel.color}`}>
                {result.riskScore}
              </span>
              <span className="text-slate-500">/100</span>
            </div>
            <p className={`text-sm font-medium mt-1 ${riskLevel.color}`}>
              {riskLevel.label}
            </p>
          </div>

          <div className={`w-20 h-20 rounded-full flex items-center justify-center ${riskLevel.bgColor} border-4 ${riskLevel.borderColor}`}>
            {result.riskScore >= 50 ? (
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : result.riskScore >= 25 ? (
              <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Triggered Rules */}
      {triggeredRules.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-300 px-1">
            Triggered Rules ({triggeredRules.length})
          </p>
          {triggeredRules.map((rule) => (
            <RuleItem
              key={rule.ruleName}
              rule={rule}
              expanded={expandedRules.has(rule.ruleName)}
              onToggle={() => toggleRule(rule.ruleName)}
            />
          ))}
        </div>
      )}

      {/* AI Explanation */}
      {aiExplanation && (
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
          <div className="flex items-center space-x-2 mb-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <p className="text-sm font-medium text-purple-400">AI Risk Analysis</p>
          </div>
          <p className="text-sm text-slate-300 whitespace-pre-line">{aiExplanation}</p>
        </div>
      )}

      {/* No Risks */}
      {triggeredRules.length === 0 && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
          <svg className="w-8 h-8 text-emerald-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <p className="text-emerald-400 font-medium">No Risks Detected</p>
          <p className="text-sm text-slate-400 mt-1">This transaction appears safe</p>
        </div>
      )}
    </div>
  );
};
