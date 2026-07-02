export type ProviderId = "codex" | "claude" | "gemini" | "opencode" | "cursor";

export interface AgentProvider {
  id: ProviderId;
  label: string;
  available: boolean;
}

export interface AgentModePlan {
  mode: "unavailable" | "single-agent" | "single-provider-multi-role" | "cross-provider-review" | "parallel-delivery";
  trustLevel: "none" | "basic" | "medium" | "high" | "highest";
  detectedProviders: string[];
  roleAssignments: {
    implementer?: ProviderId;
    specReviewer?: ProviderId;
    codeReviewer?: ProviderId;
    testReviewer?: ProviderId;
  };
  recommendation: string;
}

export function planAgentMode(_providers: AgentProvider[]): AgentModePlan {
  const availableProviders = _providers.filter((provider) => provider.available);
  const [primary, secondary, tertiary] = availableProviders;

  if (!primary) {
    return {
      mode: "unavailable",
      trustLevel: "none",
      detectedProviders: [],
      roleAssignments: {},
      recommendation: "未检测到可用 Agent CLI。请先安装 Codex、Claude Code 或 Gemini CLI。",
    };
  }

  if (availableProviders.length === 1) {
    return {
      mode: "single-provider-multi-role",
      trustLevel: "medium",
      detectedProviders: [primary.label],
      roleAssignments: {
        implementer: primary.id,
        specReviewer: primary.id,
        codeReviewer: primary.id,
        testReviewer: primary.id,
      },
      recommendation: `当前检测到：${primary.label}。可用模式：单 Provider 多角色。建议安装 Claude Code 或 Gemini CLI 后可开启跨 Provider 评审。`,
    };
  }

  if (availableProviders.length === 2) {
    return {
      mode: "cross-provider-review",
      trustLevel: "high",
      detectedProviders: availableProviders.map((provider) => provider.label),
      roleAssignments: {
        implementer: primary.id,
        specReviewer: secondary.id,
        codeReviewer: secondary.id,
        testReviewer: primary.id,
      },
      recommendation: `${primary.label} 负责实现，${secondary.label} 负责交叉评审。安装第三个 Provider 后可开启并行交付增强模式。`,
    };
  }

  return {
    mode: "parallel-delivery",
    trustLevel: "highest",
    detectedProviders: availableProviders.map((provider) => provider.label),
    roleAssignments: {
      implementer: primary.id,
      specReviewer: secondary.id,
      codeReviewer: secondary.id,
      testReviewer: tertiary.id,
    },
    recommendation: "已开启多 Provider 并行交付模式：并行实现、跨 Provider 评审、人工门禁。",
  };
}
