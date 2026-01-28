import React, { useState } from 'react';

interface LiabilityNoticeProps {
  notice: string;
  riskScore: number;
  rulesTriggered: string[];
  onAcknowledge?: () => void;
  acknowledged?: boolean;
  className?: string;
}

export const LiabilityNotice: React.FC<LiabilityNoticeProps> = ({
  notice,
  riskScore,
  rulesTriggered,
  onAcknowledge,
  acknowledged = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isHighRisk = riskScore >= 50;
  const isMediumRisk = riskScore >= 25;

  const getBorderColor = () => {
    if (isHighRisk) return 'border-red-500/50';
    if (isMediumRisk) return 'border-amber-500/50';
    return 'border-emerald-500/50';
  };

  const getBgColor = () => {
    if (isHighRisk) return 'bg-red-500/10';
    if (isMediumRisk) return 'bg-amber-500/10';
    return 'bg-emerald-500/10';
  };

  const getIconColor = () => {
    if (isHighRisk) return 'text-red-400';
    if (isMediumRisk) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className={`rounded-xl border-2 ${getBorderColor()} ${getBgColor()} overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-start space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getBgColor()} ${getIconColor()}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">责任声明</h3>
            <p className="text-sm text-slate-400 mt-1">
              {isHighRisk
                ? '高风险交易 - 请仔细阅读以下声明'
                : isMediumRisk
                ? '中风险交易 - 建议阅读以下声明'
                : '低风险交易 - 以下是标准声明'}
            </p>
          </div>
        </div>
      </div>

      {/* Notice Content */}
      <div className="p-4">
        <div className={`transition-all duration-300 ${isExpanded ? '' : 'max-h-20 overflow-hidden'}`}>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {notice}
          </p>

          {rulesTriggered.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-xs text-slate-500 mb-2">触发的风险规则：</p>
              <div className="flex flex-wrap gap-2">
                {rulesTriggered.map((rule, i) => (
                  <span
                    key={i}
                    className={`px-2 py-1 text-xs rounded ${
                      isHighRisk
                        ? 'bg-red-500/20 text-red-400'
                        : isMediumRisk
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Expand/Collapse Button */}
        {notice.length > 150 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-xs text-primary-400 hover:text-primary-300 flex items-center space-x-1 cursor-pointer"
          >
            <span>{isExpanded ? '收起' : '展开全部'}</span>
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Acknowledge Button */}
      {onAcknowledge && !acknowledged && (
        <div className="p-4 pt-0">
          <button
            onClick={onAcknowledge}
            className={`w-full py-3 rounded-xl font-medium transition-all cursor-pointer ${
              isHighRisk
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : isMediumRisk
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
            }`}
          >
            我已阅读并理解上述风险
          </button>
        </div>
      )}

      {/* Acknowledged State */}
      {acknowledged && (
        <div className="p-4 pt-0">
          <div className="flex items-center justify-center space-x-2 py-2 text-emerald-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">已确认知晓风险</span>
          </div>
        </div>
      )}
    </div>
  );
};
