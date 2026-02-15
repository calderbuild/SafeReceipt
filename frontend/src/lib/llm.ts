/**
 * LLM Service - Natural Language Intent Parsing
 *
 * Integrates OpenAI-compatible API for:
 * 1. Parsing natural language into structured transaction intent
 * 2. Generating human-readable risk explanations
 */

interface ParsedApproveIntent {
  actionType: 'APPROVE';
  token: string;
  spender: string;
  amount: string;
  isUnlimited: boolean;
  confidence: number;
  reasoning: string;
}

interface ParsedBatchPayIntent {
  actionType: 'BATCH_PAY';
  recipients: Array<{ address: string; amount: string }>;
  confidence: number;
  reasoning: string;
}

type ParsedIntent = ParsedApproveIntent | ParsedBatchPayIntent;

interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_CONFIG: LLMConfig = {
  apiKey: (import.meta.env.VITE_OPENAI_API_KEY || '').trim(),
  baseUrl: (import.meta.env.VITE_OPENAI_BASE_URL || 'https://newapi.deepwisdom.ai/v1').trim(),
  model: (import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o').trim(),
};

const INTENT_PARSE_PROMPT = `You are an expert at parsing blockchain transaction intents from natural language.

Given a user's description, extract the structured transaction intent.

KNOWN ADDRESSES (Testnet - use these when user mentions these names):
Tokens:
- USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- USDT: 0xdAC17F958D2ee523a2206206994597C13D831ec7
- WETH: 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
- DAI: 0x6B175474E89094C44Da98b954EescdeCB5BAd

Protocols/Spenders:
- Uniswap (Router): 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
- 1inch: 0x1111111254fb6c44bac0bed2854e76f90643097d
- OpenSea: 0x00000000006c3852cbEf3e08E8dF289169EdE581

RULES:
1. For token approvals (ERC20 approve):
   - Extract: token address, spender address, amount
   - "unlimited", "max" means isUnlimited=true
   - If user mentions a known name (like "USDC", "Uniswap"), use the address from KNOWN ADDRESSES above
   - Amount should be in wei (multiply by 10^decimals, USDC/USDT=6, others=18)

2. For batch transfers:
   - Extract: list of (recipient address, amount) pairs
   - Parse CSV-like formats or natural language lists

3. Address format:
   - Must be 0x followed by 40 hex characters
   - Use KNOWN ADDRESSES when user mentions known names
   - If user gives an unknown name, list it in missingInfo

OUTPUT FORMAT (JSON only, no markdown):
{
  "actionType": "APPROVE" | "BATCH_PAY",
  "parsed": {
    // For APPROVE:
    "token": "0x...",
    "spender": "0x...",
    "amount": "1000000000000000000",
    "isUnlimited": false

    // For BATCH_PAY:
    "recipients": [{"address": "0x...", "amount": "..."}]
  },
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "missingInfo": ["list of missing required info"] // empty if complete
}`;

const RISK_EXPLAIN_PROMPT = `You are an expert at explaining blockchain transaction details in simple terms.

Given a list of analysis results and their context, explain:
1. What each item means in plain language
2. Why it matters for the user
3. A recommendation (proceed with caution, review carefully, or reconsider)

Keep explanations concise and actionable. Use bullet points.
Output in the user's language (detect from input).`;

/**
 * Parse natural language into structured transaction intent
 */
export async function parseNaturalLanguageIntent(
  userInput: string,
  config: Partial<LLMConfig> = {}
): Promise<{
  success: boolean;
  intent?: ParsedIntent;
  error?: string;
  missingInfo?: string[];
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.apiKey) {
    return {
      success: false,
      error: 'LLM API key not configured. Please set VITE_OPENAI_API_KEY in environment.',
    };
  }

  try {
    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: INTENT_PARSE_PROMPT },
          { role: 'user', content: userInput },
        ],
        temperature: 0.1, // Low temperature for consistent parsing
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    // Parse JSON response (handle potential markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.missingInfo && parsed.missingInfo.length > 0) {
      return {
        success: false,
        error: `Missing information: ${parsed.missingInfo.join(', ')}`,
        missingInfo: parsed.missingInfo,
      };
    }

    if (parsed.actionType === 'APPROVE') {
      return {
        success: true,
        intent: {
          actionType: 'APPROVE',
          token: parsed.parsed.token,
          spender: parsed.parsed.spender,
          amount: parsed.parsed.amount,
          isUnlimited: parsed.parsed.isUnlimited || false,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning,
        },
      };
    } else if (parsed.actionType === 'BATCH_PAY') {
      return {
        success: true,
        intent: {
          actionType: 'BATCH_PAY',
          recipients: parsed.parsed.recipients,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning,
        },
      };
    }

    return {
      success: false,
      error: 'Unknown action type',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to parse intent',
    };
  }
}

/**
 * Generate human-readable risk explanation
 */
export async function explainRisks(
  rulesTriggered: string[],
  riskScore: number,
  intentContext: string,
  config: Partial<LLMConfig> = {}
): Promise<{
  success: boolean;
  explanation?: string;
  error?: string;
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!cfg.apiKey) {
    return {
      success: false,
      error: 'LLM API key not configured',
    };
  }

  if (rulesTriggered.length === 0) {
    return {
      success: true,
      explanation: 'No significant risks detected. This transaction appears safe.',
    };
  }

  try {
    const userMessage = `
Transaction Context: ${intentContext}
Risk Score: ${riskScore}/100
Rules Triggered: ${rulesTriggered.join(', ')}

Please explain these risks in simple terms.`;

    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: RISK_EXPLAIN_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content;

    return {
      success: true,
      explanation: explanation || 'Unable to generate risk explanation.',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if LLM is configured and available
 */
export function isLLMConfigured(): boolean {
  return !!DEFAULT_CONFIG.apiKey;
}

export type { ParsedIntent, ParsedApproveIntent, ParsedBatchPayIntent, LLMConfig };
