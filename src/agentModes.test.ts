import { describe, expect, it } from "vitest";
import { planAgentMode } from "./agentModes";

describe("planAgentMode", () => {
  it("uses single-provider multi-role mode when only Codex is available", () => {
    const plan = planAgentMode([
      { id: "codex", label: "Codex", available: true },
      { id: "claude", label: "Claude Code", available: false },
      { id: "gemini", label: "Gemini CLI", available: false },
    ]);

    expect(plan.mode).toBe("single-provider-multi-role");
    expect(plan.trustLevel).toBe("medium");
    expect(plan.detectedProviders).toEqual(["Codex"]);
    expect(plan.roleAssignments).toEqual({
      implementer: "codex",
      specReviewer: "codex",
      codeReviewer: "codex",
      testReviewer: "codex",
    });
    expect(plan.recommendation).toContain("跨 Provider 评审");
  });

  it("prefers cross-provider review when Codex and Claude are available", () => {
    const plan = planAgentMode([
      { id: "codex", label: "Codex", available: true },
      { id: "claude", label: "Claude Code", available: true },
      { id: "gemini", label: "Gemini CLI", available: false },
    ]);

    expect(plan.mode).toBe("cross-provider-review");
    expect(plan.trustLevel).toBe("high");
    expect(plan.roleAssignments.implementer).toBe("codex");
    expect(plan.roleAssignments.specReviewer).toBe("claude");
    expect(plan.roleAssignments.codeReviewer).toBe("claude");
  });
});
