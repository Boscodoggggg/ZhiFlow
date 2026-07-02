import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { ProjectApiSnapshot } from "./projectApi";

const snapshot: ProjectApiSnapshot = {
  repo: {
    name: "测试仓库",
    path: "/tmp/test-repo",
    branch: "main",
    isGit: true,
  },
  sources: [
    {
      id: "openspec",
      type: "openspec",
      label: "OpenSpec",
      root: "openspec",
      changeCount: 1,
    },
  ],
  changes: [
    {
      id: "openspec-login",
      title: "登录流程",
      path: "openspec/changes/login",
      sourceType: "openspec",
      sourceLabel: "OpenSpec",
      artifacts: [{ kind: "tasks", path: "openspec/changes/login/tasks.md" }],
      taskCount: 1,
      completedTaskCount: 0,
    },
  ],
  tasks: [
    {
      id: "openspec-login-01",
      title: "实现登录接口",
      done: false,
      changeId: "openspec-login",
      sourceType: "openspec",
      path: "openspec/changes/login/tasks.md",
    },
  ],
  providers: [{ id: "codex", label: "Codex", available: true }],
};

describe("App interactions", () => {
  let storage: Storage;

  beforeEach(() => {
    const values = new Map<string, string>();
    storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => Array.from(values.keys())[index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    };
    vi.stubGlobal("localStorage", storage);
    document.documentElement.removeAttribute("data-theme");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(snapshot), { headers: { "Content-Type": "application/json" } })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens real settings view and persists theme changes", async () => {
    render(<App />);

    expect(await screen.findByText("测试仓库 · 真实项目扫描")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    expect(screen.getByRole("heading", { name: "设置" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "切换主题" }));

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(storage.getItem("zhiflow-theme")).toBe("light");
  });
});
