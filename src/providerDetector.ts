import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AgentProvider, ProviderId } from "./agentModes";

const execFileAsync = promisify(execFile);

const providerCommands: Array<{ id: ProviderId; label: string; command: string }> = [
  { id: "codex", label: "Codex", command: "codex" },
  { id: "claude", label: "Claude Code", command: "claude" },
  { id: "gemini", label: "Gemini CLI", command: "gemini" },
  { id: "opencode", label: "OpenCode", command: "opencode" },
  { id: "cursor", label: "Cursor Agent", command: "cursor" },
];

export async function detectProvidersWith(commandExists: (command: string) => Promise<boolean>): Promise<AgentProvider[]> {
  return Promise.all(
    providerCommands.map(async (provider) => ({
      id: provider.id,
      label: provider.label,
      available: await commandExists(provider.command),
    })),
  );
}

export async function detectLocalProviders(): Promise<AgentProvider[]> {
  return detectProvidersWith(async (command) => {
    try {
      await execFileAsync("which", [command]);
      return true;
    } catch {
      return false;
    }
  });
}
