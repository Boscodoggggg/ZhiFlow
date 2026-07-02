import type { ProjectSnapshot } from "./projectScanner";
import type { AgentProvider } from "./agentModes";

export type ProjectApiSnapshot = ProjectSnapshot & {
  providers: AgentProvider[];
};

export async function fetchProjectSnapshot(): Promise<ProjectApiSnapshot> {
  const response = await fetch("/api/project");
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Failed to load project: ${response.status}`);
  }
  return response.json() as Promise<ProjectApiSnapshot>;
}
