import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { scanProject } from "./projectScanner";

async function makeRepo() {
  const dir = await mkdtemp(join(tmpdir(), "zhiflow-scan-"));
  await mkdir(join(dir, ".git"), { recursive: true });
  await writeFile(join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
  return dir;
}

describe("scanProject", () => {
  it("detects OpenSpec changes and parses markdown tasks", async () => {
    const repo = await makeRepo();
    const changeDir = join(repo, "openspec", "changes", "add-login");
    await mkdir(changeDir, { recursive: true });
    await writeFile(join(changeDir, "proposal.md"), "# Add Login\n\n让用户通过邮箱密码登录。\n");
    await writeFile(join(changeDir, "design.md"), "# Design\n\nUse JWT.\n");
    await writeFile(
      join(changeDir, "tasks.md"),
      "- [ ] 实现登录 API\n- [x] 编写登录测试\n- [ ] 更新登录页面\n",
    );

    const snapshot = await scanProject(repo);

    expect(snapshot.repo).toMatchObject({ name: repo.split("/").at(-1), branch: "main", isGit: true });
    expect(snapshot.sources.map((source) => source.type)).toContain("openspec");
    expect(snapshot.changes).toHaveLength(1);
    expect(snapshot.changes[0]).toMatchObject({
      title: "Add Login",
      sourceType: "openspec",
      taskCount: 3,
      completedTaskCount: 1,
    });
    expect(snapshot.tasks.map((task) => task.title)).toEqual(["实现登录 API", "编写登录测试", "更新登录页面"]);
  });

  it("detects Spec Kit specs without requiring ZhiFlow native files", async () => {
    const repo = await makeRepo();
    const featureDir = join(repo, "specs", "001-dark-mode");
    await mkdir(featureDir, { recursive: true });
    await mkdir(join(repo, ".specify"), { recursive: true });
    await writeFile(join(featureDir, "spec.md"), "# Dark Mode\n\n用户可以切换暗色模式。\n");
    await writeFile(join(featureDir, "plan.md"), "# Plan\n\nAdd theme provider.\n");
    await writeFile(join(featureDir, "tasks.md"), "- [ ] Add theme provider\n- [ ] Wire local storage\n");

    const snapshot = await scanProject(repo);

    expect(snapshot.sources.map((source) => source.type)).toContain("spec-kit");
    expect(snapshot.changes[0]).toMatchObject({
      title: "Dark Mode",
      sourceType: "spec-kit",
      taskCount: 2,
    });
  });

  it("falls back to generic markdown task files when no SDD framework exists", async () => {
    const repo = await makeRepo();
    await writeFile(join(repo, "tasks.md"), "# Refactor Auth\n\n- [ ] Split auth service\n");

    const snapshot = await scanProject(repo);

    expect(snapshot.sources.map((source) => source.type)).toContain("markdown");
    expect(snapshot.changes[0]).toMatchObject({
      title: "Refactor Auth",
      sourceType: "markdown",
      taskCount: 1,
    });
  });
});
