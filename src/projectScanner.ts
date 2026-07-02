import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";

export type SpecSourceType = "openspec" | "spec-kit" | "markdown" | "zhiflow";

export interface ProjectSnapshot {
  repo: {
    name: string;
    path: string;
    branch: string | null;
    isGit: boolean;
  };
  sources: Array<{
    id: string;
    type: SpecSourceType;
    label: string;
    root: string;
    changeCount: number;
  }>;
  changes: Array<{
    id: string;
    title: string;
    path: string;
    sourceType: SpecSourceType;
    sourceLabel: string;
    artifacts: Array<{ kind: "proposal" | "spec" | "plan" | "design" | "tasks"; path: string }>;
    taskCount: number;
    completedTaskCount: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    done: boolean;
    changeId: string;
    sourceType: SpecSourceType;
    path: string;
  }>;
}

export async function scanProject(projectPath: string): Promise<ProjectSnapshot> {
  const repo = await readRepo(projectPath);
  const sources: ProjectSnapshot["sources"] = [];
  const changes: ProjectSnapshot["changes"] = [];
  const tasks: ProjectSnapshot["tasks"] = [];

  await collectOpenSpec(projectPath, sources, changes, tasks);
  await collectSpecKit(projectPath, sources, changes, tasks);
  if (changes.length === 0) {
    await collectGenericMarkdown(projectPath, sources, changes, tasks);
  }

  return {
    repo,
    sources,
    changes,
    tasks,
  };
}

async function readRepo(projectPath: string): Promise<ProjectSnapshot["repo"]> {
  const gitDir = join(projectPath, ".git");
  const isGit = await exists(gitDir);
  return {
    name: basename(projectPath),
    path: projectPath,
    branch: isGit ? await readBranch(gitDir) : null,
    isGit,
  };
}

async function readBranch(gitDir: string): Promise<string | null> {
  try {
    const head = (await readFile(join(gitDir, "HEAD"), "utf8")).trim();
    return head.startsWith("ref: refs/heads/") ? head.replace("ref: refs/heads/", "") : head.slice(0, 8);
  } catch {
    return null;
  }
}

async function collectOpenSpec(
  projectPath: string,
  sources: ProjectSnapshot["sources"],
  changes: ProjectSnapshot["changes"],
  tasks: ProjectSnapshot["tasks"],
) {
  const root = join(projectPath, "openspec");
  const changesRoot = join(root, "changes");
  if (!(await exists(changesRoot))) return;

  const dirs = await childDirectories(changesRoot);
  if (dirs.length === 0) return;

  const source = { id: "openspec", type: "openspec" as const, label: "OpenSpec", root: relative(projectPath, root), changeCount: 0 };
  sources.push(source);
  for (const dir of dirs) {
    const added = await addChangeFromDir(projectPath, dir, "openspec", "OpenSpec", changes, tasks, {
      proposal: "proposal.md",
      design: "design.md",
      tasks: "tasks.md",
    });
    if (added) source.changeCount += 1;
  }
}

async function collectSpecKit(
  projectPath: string,
  sources: ProjectSnapshot["sources"],
  changes: ProjectSnapshot["changes"],
  tasks: ProjectSnapshot["tasks"],
) {
  const specsRoot = join(projectPath, "specs");
  if (!(await exists(specsRoot))) return;

  const dirs = await childDirectories(specsRoot);
  const specDirs = [];
  for (const dir of dirs) {
    if ((await exists(join(dir, "spec.md"))) || (await exists(join(dir, "plan.md"))) || (await exists(join(dir, "tasks.md")))) {
      specDirs.push(dir);
    }
  }
  if (specDirs.length === 0) return;

  const source = { id: "spec-kit", type: "spec-kit" as const, label: "Spec Kit", root: relative(projectPath, specsRoot), changeCount: 0 };
  sources.push(source);
  for (const dir of specDirs) {
    const added = await addChangeFromDir(projectPath, dir, "spec-kit", "Spec Kit", changes, tasks, {
      spec: "spec.md",
      plan: "plan.md",
      tasks: "tasks.md",
    });
    if (added) source.changeCount += 1;
  }
}

async function collectGenericMarkdown(
  projectPath: string,
  sources: ProjectSnapshot["sources"],
  changes: ProjectSnapshot["changes"],
  tasks: ProjectSnapshot["tasks"],
) {
  const markdownFiles = await walk(projectPath);
  const taskFiles = markdownFiles.filter((file) => basename(file).toLowerCase() === "tasks.md");
  if (taskFiles.length === 0) return;

  const source = { id: "markdown", type: "markdown" as const, label: "Markdown", root: ".", changeCount: 0 };
  sources.push(source);
  for (const taskFile of taskFiles) {
    const dir = taskFile.slice(0, -"/tasks.md".length);
    const added = await addChangeFromDir(projectPath, dir || projectPath, "markdown", "Markdown", changes, tasks, {
      tasks: basename(taskFile),
    });
    if (added) source.changeCount += 1;
  }
}

async function addChangeFromDir(
  projectPath: string,
  dir: string,
  sourceType: SpecSourceType,
  sourceLabel: string,
  changes: ProjectSnapshot["changes"],
  tasks: ProjectSnapshot["tasks"],
  artifactFiles: Partial<Record<"proposal" | "spec" | "plan" | "design" | "tasks", string>>,
): Promise<boolean> {
  const artifacts: ProjectSnapshot["changes"][number]["artifacts"] = [];
  for (const [kind, filename] of Object.entries(artifactFiles)) {
    if (!filename) continue;
    const fullPath = join(dir, filename);
    if (await exists(fullPath)) {
      artifacts.push({ kind: kind as "proposal" | "spec" | "plan" | "design" | "tasks", path: relative(projectPath, fullPath) });
    }
  }

  const title = await readTitleFromArtifacts(projectPath, artifacts, basename(dir));
  const changeId = safeId(`${sourceType}-${relative(projectPath, dir) || basename(dir)}`);
  const parsedTasks = await parseTasks(projectPath, dir, artifactFiles.tasks);
  if (artifacts.length === 0 && parsedTasks.length === 0) return false;
  const completedTaskCount = parsedTasks.filter((task) => task.done).length;

  changes.push({
    id: changeId,
    title,
    path: relative(projectPath, dir) || ".",
    sourceType,
    sourceLabel,
    artifacts,
    taskCount: parsedTasks.length,
    completedTaskCount,
  });

  parsedTasks.forEach((task, index) => {
    tasks.push({
      id: `${changeId}-${String(index + 1).padStart(2, "0")}`,
      title: task.title,
      done: task.done,
      changeId,
      sourceType,
      path: task.path,
    });
  });
  return true;
}

async function readTitleFromArtifacts(
  projectPath: string,
  artifacts: ProjectSnapshot["changes"][number]["artifacts"],
  fallback: string,
) {
  for (const artifact of artifacts) {
    if (!["proposal", "spec", "tasks"].includes(artifact.kind)) continue;
    const content = await readFile(join(projectPath, artifact.path), "utf8");
    const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    if (heading) return heading;
  }
  return fallback.replace(/^\d+[-_]/, "").replace(/[-_]/g, " ");
}

async function parseTasks(projectPath: string, dir: string, filename?: string) {
  if (!filename) return [];
  const taskFile = join(dir, filename);
  if (!(await exists(taskFile))) return [];
  const content = await readFile(taskFile, "utf8");
  const path = relative(projectPath, taskFile);
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+?)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      done: match[1].toLowerCase() === "x",
      title: match[2].trim(),
      path,
    }));
}

async function childDirectories(parent: string) {
  try {
    const entries = await readdir(parent, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => join(parent, entry.name)).sort();
  } catch {
    return [];
  }
}

async function walk(root: string) {
  const files: string[] = [];
  async function visit(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (shouldSkip(projectRelative(root, fullPath))) continue;
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }
  await visit(root);
  return files.sort();
}

function shouldSkip(path: string) {
  const segments = path.split(sep);
  return segments.some((segment) => [".git", "node_modules", "dist", ".zhiflow", "canvas"].includes(segment));
}

function projectRelative(root: string, fullPath: string) {
  return relative(root, fullPath);
}

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "change";
}
