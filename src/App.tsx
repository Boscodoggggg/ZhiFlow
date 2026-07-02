import * as RadixSwitch from "@radix-ui/react-switch";
import * as RadixTabs from "@radix-ui/react-tabs";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { SiClaude, SiCursor, SiGooglegemini } from "@icons-pack/react-simple-icons";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Bot,
  Boxes,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Code2,
  GitBranch,
  GitPullRequestArrow,
  Globe2,
  Languages,
  LayoutDashboard,
  LockKeyhole,
  Moon,
  Network,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";
import { planAgentMode, type AgentProvider, type ProviderId } from "./agentModes";
import type { Locale, MessageKey } from "./i18n";
import { createTranslator } from "./i18n";
import { fetchProjectSnapshot, type ProjectApiSnapshot } from "./projectApi";
import type { ProjectSnapshot, SpecSourceType } from "./projectScanner";
import { defaultTheme, normalizeTheme, themeStorageKey, toggleTheme, type Theme } from "./theme";

type UiTaskStatus = "todo" | "running" | "review" | "done";
type NavView = "workspace" | "tasks" | "runs" | "reviews" | "gate" | "settings";
type TopTab = "overview" | "board" | "sources" | "history" | "config";
type InspectorTab = "run" | "diff" | "review" | "decision";
type TaskFilter = "all" | "todo" | "done";

interface UiTask {
  id: string;
  title: string;
  type: string;
  description: string;
  status: UiTaskStatus;
  providerLabel: string;
  providerState: string;
  providerTone: "cyan" | "amber" | "blue" | "green";
  worktree: string;
  progress: number;
  elapsed: string;
  commits: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  verdict: "approved" | "needsChanges" | "blocked" | "running";
  review: string;
  log: string[];
  diff: string[];
  sourcePath: string;
  sourceType: SpecSourceType;
  done: boolean;
}

interface ActionOutput {
  title: string;
  body: string[];
}

const columns: Array<{ status: UiTaskStatus; key: "board.todo" | "board.running" | "board.review" | "board.done" }> = [
  { status: "todo", key: "board.todo" },
  { status: "running", key: "board.running" },
  { status: "review", key: "board.review" },
  { status: "done", key: "board.done" },
];

const navItems: Array<{ view: NavView; key: MessageKey; icon: LucideIcon }> = [
  { view: "workspace", key: "nav.workspace", icon: LayoutDashboard },
  { view: "tasks", key: "nav.tasks", icon: ClipboardList },
  { view: "runs", key: "nav.runs", icon: TerminalSquare },
  { view: "reviews", key: "nav.reviews", icon: ShieldCheck },
  { view: "gate", key: "nav.gate", icon: LockKeyhole },
  { view: "settings", key: "nav.settings", icon: Settings },
];

const topTabs: Array<{ tab: TopTab; key: MessageKey }> = [
  { tab: "overview", key: "tabs.overview" },
  { tab: "board", key: "tabs.board" },
  { tab: "sources", key: "tabs.sources" },
  { tab: "history", key: "tabs.history" },
  { tab: "config", key: "tabs.config" },
];

const providerClass = {
  cyan: "tone-cyan",
  amber: "tone-amber",
  blue: "tone-blue",
  green: "tone-green",
} as const;

function sourceTypeLabel(type: SpecSourceType) {
  if (type === "openspec") return "OpenSpec";
  if (type === "spec-kit") return "Spec Kit";
  if (type === "zhiflow") return "ZhiFlow";
  return "Markdown";
}

function statusLabel(status: UiTask["verdict"], t: ReturnType<typeof createTranslator>) {
  if (status === "approved") return t("status.approved");
  if (status === "needsChanges") return t("status.needsChanges");
  if (status === "blocked") return t("status.blocked");
  return "待执行";
}

function toUiTasks(snapshot: ProjectSnapshot | null): UiTask[] {
  if (!snapshot) return [];
  return snapshot.tasks.map((task) => {
    const change = snapshot.changes.find((item) => item.id === task.changeId);
    return {
      id: task.id,
      title: task.title,
      type: sourceTypeLabel(task.sourceType),
      description: `${change?.title ?? "未命名变更"} · ${task.path}`,
      status: task.done ? "done" : "todo",
      providerLabel: "未分配",
      providerState: "待执行",
      providerTone: task.done ? "green" : "cyan",
      worktree: "尚未创建",
      progress: task.done ? 100 : 0,
      elapsed: "-",
      commits: 0,
      filesChanged: 0,
      additions: 0,
      deletions: 0,
      verdict: task.done ? "approved" : "running",
      review: task.done ? "任务已在源文件中标记完成。" : "尚未启动 Agent 执行或评审。",
      log: [`[SOURCE] ${sourceTypeLabel(task.sourceType)} · ${task.path}`, "[STATE] 已读取真实任务，等待创建 worktree 与分配 Agent。"],
      diff: [],
      sourcePath: task.path,
      sourceType: task.sourceType,
      done: task.done,
    };
  });
}

function readInitialTheme() {
  if (typeof window === "undefined") return defaultTheme;
  try {
    return normalizeTheme(window.localStorage.getItem(themeStorageKey));
  } catch {
    return defaultTheme;
  }
}

function filterLabel(filter: TaskFilter, t: ReturnType<typeof createTranslator>) {
  if (filter === "todo") return t("board.filterTodo");
  if (filter === "done") return t("board.filterDone");
  return t("board.filterAll");
}

function nextFilter(filter: TaskFilter): TaskFilter {
  if (filter === "all") return "todo";
  if (filter === "todo") return "done";
  return "all";
}

function ProviderBrandIcon({ providerId, size = 15 }: { providerId: ProviderId; size?: number }) {
  if (providerId === "claude") return <SiClaude aria-hidden="true" color="currentColor" focusable="false" size={size} title="" />;
  if (providerId === "gemini") return <SiGooglegemini aria-hidden="true" color="currentColor" focusable="false" size={size} title="" />;
  if (providerId === "cursor") return <SiCursor aria-hidden="true" color="currentColor" focusable="false" size={size} title="" />;
  if (providerId === "opencode") return <Code2 aria-hidden="true" size={size} />;
  return <Bot aria-hidden="true" size={size} />;
}

function ProviderBadges({ providers }: { providers: AgentProvider[] }) {
  return (
    <div className="provider-badges" aria-label="Agent providers">
      {providers.map((provider) => (
        <span className={`provider-chip ${provider.available ? "available" : "missing"}`} key={provider.id}>
          <ProviderBrandIcon providerId={provider.id} />
          <span>{provider.label}</span>
        </span>
      ))}
    </div>
  );
}

function IconTooltipButton({
  label,
  className = "icon-button",
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>
        <button className={className} type="button" aria-label={label} onClick={onClick}>
          {children}
        </button>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className="tooltip-content" sideOffset={8}>
          {label}
          <RadixTooltip.Arrow className="tooltip-arrow" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

function safeTaskSlug(taskId: string) {
  return taskId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "task";
}

function buildWorktreeCommand(task: UiTask) {
  const slug = safeTaskSlug(task.id);
  return `git worktree add .zhiflow/worktrees/${slug} -b zhiflow/${slug}`;
}

function panelTitle(activeNav: NavView, activeTab: TopTab, t: ReturnType<typeof createTranslator>) {
  if (activeNav === "settings" || activeTab === "config") return t("settings.title");
  if (activeNav === "runs") return t("views.runs");
  if (activeNav === "reviews") return t("views.reviews");
  if (activeNav === "gate") return t("views.gate");
  if (activeTab === "overview") return t("views.overview");
  if (activeTab === "sources") return t("views.sources");
  if (activeTab === "history") return t("views.history");
  return t("board.title");
}

function panelSubtitle(activeNav: NavView, activeTab: TopTab, t: ReturnType<typeof createTranslator>, total: number) {
  if (activeNav === "settings" || activeTab === "config") return t("settings.subtitle");
  if (activeNav === "runs") return t("views.runsHint");
  if (activeNav === "reviews") return t("views.reviewsHint");
  if (activeNav === "gate") return t("views.gateHint");
  if (activeTab === "overview") return t("views.overviewHint");
  if (activeTab === "sources") return t("views.sourcesHint");
  if (activeTab === "history") return t("views.historyHint");
  return total > 0 ? "来自真实 SDD/Markdown 文件" : "当前项目暂无可执行任务";
}

export function App() {
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [snapshot, setSnapshot] = useState<ProjectApiSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavView>("tasks");
  const [activeTopTab, setActiveTopTab] = useState<TopTab>("board");
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("run");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [activeSourceId, setActiveSourceId] = useState<string>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionOutput, setActionOutput] = useState<ActionOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const t = useMemo(() => createTranslator(locale), [locale]);

  const loadProject = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProjectSnapshot();
      setSnapshot(data);
      setSelectedTaskId((current) => (current && data.tasks.some((task) => task.id === current) ? current : data.tasks[0]?.id ?? null));
      setActiveSourceId((current) => (current === "all" || data.sources.some((source) => source.id === current) ? current : "all"));
      return data;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }, [theme]);

  const providers: AgentProvider[] = snapshot?.providers ?? [];
  const modePlan = useMemo(() => planAgentMode(providers), [providers]);
  const tasks = useMemo(() => toUiTasks(snapshot), [snapshot]);
  const sourceFilteredTasks = useMemo(
    () => tasks.filter((task) => activeSourceId === "all" || task.sourceType === activeSourceId),
    [activeSourceId, tasks],
  );
  const filteredTasks = useMemo(
    () => sourceFilteredTasks.filter((task) => taskFilter === "all" || (taskFilter === "done" ? task.done : !task.done)),
    [sourceFilteredTasks, taskFilter],
  );
  const selectedTask = filteredTasks.find((task) => task.id === selectedTaskId) ?? filteredTasks[0] ?? tasks[0] ?? null;
  const completedCount = tasks.filter((task) => task.status === "done").length;
  const pendingCount = tasks.length - completedCount;
  const totalProgress = tasks.length === 0 ? 0 : Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length);

  function handleNavSelect(view: NavView) {
    setActiveNav(view);
    if (view === "workspace") setActiveTopTab("overview");
    if (view === "tasks") setActiveTopTab("board");
    if (view === "runs" || view === "reviews") setActiveTopTab("history");
    if (view === "settings") setActiveTopTab("config");
    setNotice(null);
  }

  function handleTopTabSelect(tab: TopTab) {
    setActiveTopTab(tab);
    if (tab === "board") setActiveNav("tasks");
    if (tab === "history") setActiveNav("runs");
    if (tab === "config") setActiveNav("settings");
    if (tab === "overview" || tab === "sources") setActiveNav("workspace");
    setNotice(null);
  }

  async function handleRefresh() {
    await loadProject();
    setNotice(t("notice.refreshed"));
  }

  function handleThemeToggle() {
    const next = toggleTheme(theme);
    setTheme(next);
    setNotice(next === "light" ? t("notice.themeLight") : t("notice.themeDark"));
  }

  function handleSourceSelect(sourceId: string) {
    const next = activeSourceId === sourceId ? "all" : sourceId;
    setActiveSourceId(next);
    setActiveTopTab("board");
    setActiveNav("tasks");
  }

  function handleFilterCycle() {
    setTaskFilter((current) => nextFilter(current));
  }

  function handlePreviewWorktree(task: UiTask | null) {
    if (!task) return;
    const command = buildWorktreeCommand(task);
    setActiveInspectorTab("decision");
    setActionOutput({
      title: "Worktree 命令预览",
      body: [`cd ${snapshot?.repo.path ?? "."}`, command],
    });
    setNotice(t("notice.worktreePreview"));
  }

  function handleCreatePr(task: UiTask | null) {
    setActiveInspectorTab("decision");
    if (!task || task.diff.length === 0) {
      setActionOutput({
        title: "PR 创建被拦截",
        body: ["当前没有真实 Diff。请先执行 Agent 生成改动，再创建 PR。"],
      });
      setNotice(t("notice.prBlocked"));
      return;
    }
    setActionOutput({
      title: "PR 创建命令",
      body: ["gh pr create --fill"],
    });
  }

  const currentPanelTitle = panelTitle(activeNav, activeTopTab, t);
  const currentPanelSubtitle = panelSubtitle(activeNav, activeTopTab, t, tasks.length);

  return (
    <RadixTooltip.Provider delayDuration={240}>
      <div className="app-shell">
      <aside className="sidebar" aria-label="ZhiFlow navigation">
        <div className="brand">
          <div className="brand-mark">
            <img src="/zhiflow-mark.svg" alt="" aria-hidden="true" />
          </div>
          <div>
            <strong>{t("app.title")}</strong>
            <span>{t("app.tagline")}</span>
          </div>
        </div>

        <section className="side-section">
          <p className="side-title">{t("repo.title")}</p>
          <div className="repo-box">
            <div className="repo-name">
              <Boxes size={16} />
              <strong>{snapshot?.repo.name ?? "Loading..."}</strong>
            </div>
            <span>{snapshot?.repo.path ?? "正在读取真实项目..."}</span>
            <div className="repo-meta">
              <span>
                <GitBranch size={13} />
                {snapshot?.repo.branch ?? "no-git"}
              </span>
              <span className={snapshot?.repo.isGit ? "clean-dot" : ""}>{snapshot?.repo.isGit ? t("repo.clean") : "非 Git 仓库"}</span>
            </div>
          </div>
        </section>

        <section className="side-section">
          <div className="side-heading">
            <p className="side-title">{t("tabs.sources")}</p>
            <button type="button" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw size={12} />
              {isLoading ? t("actions.refreshing") : t("actions.refresh")}
            </button>
          </div>
          {(snapshot?.sources ?? []).map((source) => (
            <button
              className={`change-item ${activeSourceId === source.id ? "active" : ""}`}
              key={source.id}
              type="button"
              onClick={() => handleSourceSelect(source.id)}
            >
              <Sparkles size={14} />
              <span>
                <strong>{source.label}</strong>
                <small>
                  {source.root} · {source.changeCount} 个变更
                </small>
              </span>
            </button>
          ))}
          {snapshot && snapshot.sources.length === 0 ? (
            <div className="empty-source">未检测到 OpenSpec / Spec Kit / tasks.md</div>
          ) : null}
        </section>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map(({ view, key, icon: Icon }) => (
            <button
              type="button"
              className={activeNav === view ? "active" : ""}
              aria-current={activeNav === view ? "page" : undefined}
              key={view}
              onClick={() => handleNavSelect(view)}
            >
              <Icon size={16} />
              {t(key)}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{snapshot?.repo.name ? `${snapshot.repo.name} · 真实项目扫描` : "正在读取项目"}</h1>
            <RadixTabs.Root value={activeTopTab} onValueChange={(value) => handleTopTabSelect(value as TopTab)}>
              <RadixTabs.List className="tabs" aria-label="工作区视图">
                {topTabs.map(({ tab, key }) => (
                  <RadixTabs.Trigger className={activeTopTab === tab ? "active" : ""} key={tab} value={tab}>
                    {t(key)}
                  </RadixTabs.Trigger>
                ))}
              </RadixTabs.List>
            </RadixTabs.Root>
          </div>

          <div className="top-actions">
            <div className="scoreboard">
              <span>
                <Code2 size={15} />
                {snapshot?.sources.length ?? 0} 个规格来源
              </span>
              <span>
                <CheckCircle2 size={15} />
                {completedCount} 个已完成
              </span>
              <span>
                <CircleAlert size={15} />
                {pendingCount} 个待执行
              </span>
            </div>
            <div className="language-switch" aria-label={t("app.language")}>
              <Languages size={16} />
              <button type="button" className={locale === "zh-CN" ? "active" : ""} onClick={() => setLocale("zh-CN")}>
                {t("app.chinese")}
              </button>
              <span>/</span>
              <button type="button" className={locale === "en-US" ? "active" : ""} onClick={() => setLocale("en-US")}>
                {t("app.english")}
              </button>
            </div>
            <div className="theme-control">
              <span className="theme-control-icon">{theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}</span>
              <RadixSwitch.Root
                className="theme-switch"
                checked={theme === "dark"}
                aria-label={t("theme.toggle")}
                onCheckedChange={() => handleThemeToggle()}
              >
                <RadixSwitch.Thumb className="theme-switch-thumb" />
              </RadixSwitch.Root>
              <span>{theme === "dark" ? t("theme.dark") : t("theme.light")}</span>
            </div>
            <IconTooltipButton label={t("actions.notifications")} onClick={() => setNotice(t("notice.noNotifications"))}>
              <Bell size={18} />
            </IconTooltipButton>
            <IconTooltipButton label={t("actions.openSettings")} onClick={() => handleNavSelect("settings")}>
              <Settings size={18} />
            </IconTooltipButton>
          </div>
        </header>

        <section className="mode-banner">
          <div>
            <span className="mode-icon">
              <Globe2 size={18} />
            </span>
            <div>
              <strong>
                {t("task.providerMode")}：{modePlan.mode === "unavailable" ? "未检测到执行器" : modePlan.mode}
              </strong>
              <p>{modePlan.recommendation}</p>
              <ProviderBadges providers={providers} />
            </div>
          </div>
          <div className="mode-meta">
            <span>
              {t("task.detected")}：{modePlan.detectedProviders.join(" / ") || "无"}
            </span>
            <span>
              {t("task.trust")}：{modePlan.trustLevel}
            </span>
          </div>
        </section>

        <PipelineRail snapshot={snapshot} providers={providers} completedCount={completedCount} pendingCount={pendingCount} t={t} />

        <SourceStrip snapshot={snapshot} error={error} />

        {notice ? (
          <div className="notice-bar">
            <img className="notice-logo" src="/zhiflow-mark.svg" alt="" aria-hidden="true" />
            <span>{notice}</span>
            <button type="button" aria-label={t("actions.clear")} onClick={() => setNotice(null)}>
              {t("actions.clear")}
            </button>
          </div>
        ) : null}

        <div className="workbench">
          <section className="board-panel">
            <div className="panel-header">
              <div>
                <h2>{currentPanelTitle}</h2>
                <span>{currentPanelSubtitle}</span>
              </div>
              <div className="panel-tools">
                <button type="button" onClick={handleFilterCycle}>
                  <Search size={14} />
                  {filterLabel(taskFilter, t)}
                </button>
                <button type="button" aria-label={t("actions.openSettings")} onClick={() => handleNavSelect("settings")}>
                  <Settings size={14} />
                </button>
              </div>
            </div>

            {error ? <div className="empty-state error">{error}</div> : null}
            {!error ? (
              <WorkbenchBody
                activeNav={activeNav}
                activeTab={activeTopTab}
                snapshot={snapshot}
                tasks={tasks}
                filteredTasks={filteredTasks}
                activeSourceId={activeSourceId}
                taskFilter={taskFilter}
                providers={providers}
                theme={theme}
                totalProgress={totalProgress}
                completedCount={completedCount}
                pendingCount={pendingCount}
                selectedTaskId={selectedTask?.id ?? null}
                t={t}
                onOpenSources={() => handleTopTabSelect("sources")}
                onOpenTasks={() => handleTopTabSelect("board")}
                onSelectSource={handleSourceSelect}
                onSelectTask={setSelectedTaskId}
                onOpenRun={(taskId) => {
                  setSelectedTaskId(taskId);
                  setActiveInspectorTab("run");
                }}
                onOpenReview={(taskId) => {
                  setSelectedTaskId(taskId);
                  setActiveInspectorTab("review");
                }}
                onOpenDecision={() => setActiveInspectorTab("decision")}
                onToggleTheme={handleThemeToggle}
                onRefresh={handleRefresh}
              />
            ) : null}
          </section>

          <Inspector
            task={selectedTask}
            t={t}
            completedCount={completedCount}
            pendingCount={pendingCount}
            activeTab={activeInspectorTab}
            actionOutput={actionOutput}
            onTabChange={setActiveInspectorTab}
            onPreviewWorktree={() => handlePreviewWorktree(selectedTask)}
            onCreatePr={() => handleCreatePr(selectedTask)}
          />
        </div>

        <footer className="execution-strip">
          <div className="status-summary">
            <strong>{t("footer.status")}</strong>
            <div>
              <span>
                {tasks.length}
                <small>tasks</small>
              </span>
              <span>
                {completedCount}
                <small>{t("status.approved")}</small>
              </span>
              <span>
                {pendingCount}
                <small>待执行</small>
              </span>
            </div>
            <progress max="100" value={totalProgress} />
            <small>
              {t("footer.overall")} {totalProgress}%
            </small>
          </div>
          {(snapshot?.sources ?? []).slice(0, 3).map((source) => (
            <div className="mini-run tone-cyan" key={source.id}>
              <div>
                <strong>{source.label}</strong>
                <span>{source.root}</span>
              </div>
              <p>已检测 {source.changeCount} 个变更</p>
              <progress max="100" value={100} />
              <small>
                真实来源 · {source.type}
              </small>
            </div>
          ))}
          <div className="gate-box">
            <LockKeyhole size={30} />
            <div>
              <strong>{t("inspector.humanGate")}</strong>
              <span>{t("inspector.gateHint")}</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
    </RadixTooltip.Provider>
  );
}

function WorkbenchBody({
  activeNav,
  activeTab,
  snapshot,
  tasks,
  filteredTasks,
  activeSourceId,
  taskFilter,
  providers,
  theme,
  totalProgress,
  completedCount,
  pendingCount,
  selectedTaskId,
  t,
  onOpenSources,
  onOpenTasks,
  onSelectSource,
  onSelectTask,
  onOpenRun,
  onOpenReview,
  onOpenDecision,
  onToggleTheme,
  onRefresh,
}: {
  activeNav: NavView;
  activeTab: TopTab;
  snapshot: ProjectApiSnapshot | null;
  tasks: UiTask[];
  filteredTasks: UiTask[];
  activeSourceId: string;
  taskFilter: TaskFilter;
  providers: AgentProvider[];
  theme: Theme;
  totalProgress: number;
  completedCount: number;
  pendingCount: number;
  selectedTaskId: string | null;
  t: ReturnType<typeof createTranslator>;
  onOpenSources: () => void;
  onOpenTasks: () => void;
  onSelectSource: (sourceId: string) => void;
  onSelectTask: (taskId: string) => void;
  onOpenRun: (taskId: string) => void;
  onOpenReview: (taskId: string) => void;
  onOpenDecision: () => void;
  onToggleTheme: () => void;
  onRefresh: () => void;
}) {
  if (snapshot && tasks.length === 0 && activeNav !== "settings" && activeTab !== "config") {
    return <EmptyProjectState />;
  }
  if (activeNav === "settings" || activeTab === "config") {
    return <SettingsPanel snapshot={snapshot} providers={providers} theme={theme} t={t} onToggleTheme={onToggleTheme} onRefresh={onRefresh} />;
  }
  if (activeNav === "runs") {
    return <RunsPanel tasks={tasks} t={t} onOpenRun={onOpenRun} />;
  }
  if (activeNav === "reviews") {
    return <ReviewsPanel tasks={tasks} t={t} onOpenReview={onOpenReview} />;
  }
  if (activeNav === "gate") {
    return <GatePanel completedCount={completedCount} pendingCount={pendingCount} t={t} onOpenDecision={onOpenDecision} />;
  }
  if (activeTab === "overview") {
    return (
      <OverviewPanel
        snapshot={snapshot}
        tasks={tasks}
        totalProgress={totalProgress}
        completedCount={completedCount}
        pendingCount={pendingCount}
        t={t}
        onOpenSources={onOpenSources}
        onOpenTasks={onOpenTasks}
      />
    );
  }
  if (activeTab === "sources") {
    return <SourcesPanel snapshot={snapshot} activeSourceId={activeSourceId} t={t} onSelectSource={onSelectSource} />;
  }
  if (activeTab === "history") {
    return <HistoryPanel snapshot={snapshot} t={t} />;
  }
  return (
    <TaskBoard
      tasks={filteredTasks}
      selectedTaskId={selectedTaskId}
      taskFilter={taskFilter}
      t={t}
      onSelectTask={onSelectTask}
    />
  );
}

function TaskBoard({
  tasks,
  selectedTaskId,
  taskFilter,
  t,
  onSelectTask,
}: {
  tasks: UiTask[];
  selectedTaskId: string | null;
  taskFilter: TaskFilter;
  t: ReturnType<typeof createTranslator>;
  onSelectTask: (taskId: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="empty-state compact">
        <Search size={26} />
        <h2>没有匹配任务</h2>
        <p>当前筛选是“{filterLabel(taskFilter, t)}”，可以继续切换筛选或选择其他规格来源。</p>
      </div>
    );
  }
  return (
    <div className="kanban">
      {columns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);
        return (
          <div className="lane" key={column.status}>
            <div className="lane-title">
              <strong>{t(column.key)}</strong>
              <span>{columnTasks.length}</span>
            </div>
            {columnTasks.length === 0 ? (
              <div className="empty-lane">暂无真实任务</div>
            ) : (
              columnTasks.map((task) => (
                <TaskCard key={task.id} task={task} selected={task.id === selectedTaskId} onSelect={() => onSelectTask(task.id)} t={t} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function PipelineRail({
  snapshot,
  providers,
  completedCount,
  pendingCount,
  t,
}: {
  snapshot: ProjectApiSnapshot | null;
  providers: AgentProvider[];
  completedCount: number;
  pendingCount: number;
  t: ReturnType<typeof createTranslator>;
}) {
  const availableProviders = providers.filter((provider) => provider.available);
  const stages = [
    {
      label: t("pipeline.spec"),
      value: `${snapshot?.sources.length ?? 0}`,
      detail: t("pipeline.specDetail"),
      icon: ClipboardList,
      tone: "cyan",
    },
    {
      label: t("pipeline.agent"),
      value: `${availableProviders.length}`,
      detail: availableProviders.map((provider) => provider.label).join(" / ") || t("pipeline.agentWaiting"),
      icon: Network,
      tone: "green",
    },
    {
      label: t("pipeline.review"),
      value: `${completedCount}`,
      detail: `${pendingCount} ${t("pipeline.pendingGates")}`,
      icon: ShieldCheck,
      tone: "amber",
    },
    {
      label: t("pipeline.pr"),
      value: snapshot?.repo.isGit ? t("pipeline.armed") : t("pipeline.local"),
      detail: snapshot?.repo.branch ?? "no branch",
      icon: Rocket,
      tone: "blue",
    },
  ];

  return (
    <section className="pipeline-rail" aria-label="Spec to PR pipeline">
      <div className="pipeline-spine" />
      {stages.map(({ label, value, detail, icon: Icon, tone }) => (
        <div className={`pipeline-stage stage-${tone}`} key={label}>
          <span className="stage-icon">
            <Icon size={17} />
          </span>
          <div>
            <strong>{label}</strong>
            <span>{detail}</span>
          </div>
          <em>{value}</em>
        </div>
      ))}
    </section>
  );
}

function SourceStrip({ snapshot, error }: { snapshot: ProjectApiSnapshot | null; error: string | null }) {
  if (error) return null;
  return (
    <section className="source-strip">
      {(snapshot?.sources ?? []).map((source) => (
        <div className="source-card" key={source.id}>
          <strong>{source.label}</strong>
          <span>{source.root}</span>
          <em>{source.changeCount} changes</em>
        </div>
      ))}
      {snapshot && snapshot.sources.length === 0 ? (
        <div className="source-card muted">
          <strong>未检测到 SDD 来源</strong>
          <span>支持 openspec/changes、specs/*、tasks.md</span>
          <em>真实空状态</em>
        </div>
      ) : null}
    </section>
  );
}

function EmptyProjectState() {
  return (
    <div className="empty-state">
      <Sparkles size={28} />
      <h2>这个项目还没有可执行规格任务</h2>
      <p>你可以在目标项目里添加 OpenSpec、Spec Kit，或者先放一个 `tasks.md`：</p>
      <pre>{`# My Change\n\n- [ ] 第一个真实任务\n- [ ] 第二个真实任务`}</pre>
    </div>
  );
}

function OverviewPanel({
  snapshot,
  tasks,
  totalProgress,
  completedCount,
  pendingCount,
  t,
  onOpenSources,
  onOpenTasks,
}: {
  snapshot: ProjectApiSnapshot | null;
  tasks: UiTask[];
  totalProgress: number;
  completedCount: number;
  pendingCount: number;
  t: ReturnType<typeof createTranslator>;
  onOpenSources: () => void;
  onOpenTasks: () => void;
}) {
  return (
    <div className="view-panel">
      <div className="overview-grid">
        <div className="summary-tile">
          <span>{t("tabs.sources")}</span>
          <strong>{snapshot?.sources.length ?? 0}</strong>
          <button type="button" onClick={onOpenSources}>
            查看来源
          </button>
        </div>
        <div className="summary-tile">
          <span>{t("nav.tasks")}</span>
          <strong>{tasks.length}</strong>
          <button type="button" onClick={onOpenTasks}>
            打开看板
          </button>
        </div>
        <div className="summary-tile">
          <span>{t("footer.overall")}</span>
          <strong>{totalProgress}%</strong>
          <progress max="100" value={totalProgress} />
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-section">
          <strong>{t("repo.title")}</strong>
          <dl className="meta-list">
            <div>
              <dt>Path</dt>
              <dd>{snapshot?.repo.path ?? "-"}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{snapshot?.repo.branch ?? "no-git"}</dd>
            </div>
          </dl>
        </section>
        <section className="settings-section">
          <strong>{t("footer.status")}</strong>
          <dl className="meta-list">
            <div>
              <dt>{t("status.approved")}</dt>
              <dd>{completedCount}</dd>
            </div>
            <div>
              <dt>待执行</dt>
              <dd>{pendingCount}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function SourcesPanel({
  snapshot,
  activeSourceId,
  t,
  onSelectSource,
}: {
  snapshot: ProjectApiSnapshot | null;
  activeSourceId: string;
  t: ReturnType<typeof createTranslator>;
  onSelectSource: (sourceId: string) => void;
}) {
  return (
    <div className="view-panel">
      <div className="source-table">
        {(snapshot?.sources ?? []).map((source) => (
          <button
            type="button"
            className={activeSourceId === source.id ? "active" : ""}
            key={source.id}
            onClick={() => onSelectSource(source.id)}
          >
            <strong>{source.label}</strong>
            <span>{source.root}</span>
            <em>{source.changeCount} changes</em>
          </button>
        ))}
      </div>
      {snapshot && snapshot.sources.length === 0 ? <EmptyProjectState /> : null}
      <div className="panel-note">
        <Sparkles size={16} />
        <span>{t("views.sourcesHint")}</span>
      </div>
    </div>
  );
}

function HistoryPanel({ snapshot, t }: { snapshot: ProjectApiSnapshot | null; t: ReturnType<typeof createTranslator> }) {
  return (
    <div className="view-panel task-list">
      {(snapshot?.changes ?? []).map((change) => (
        <div className="task-list-row" key={change.id}>
          <div>
            <strong>{change.title}</strong>
            <span>
              {change.sourceLabel} · {change.path}
            </span>
          </div>
          <em>
            {change.completedTaskCount}/{change.taskCount} {t("nav.tasks")}
          </em>
        </div>
      ))}
      {snapshot && snapshot.changes.length === 0 ? <EmptyProjectState /> : null}
    </div>
  );
}

function RunsPanel({ tasks, t, onOpenRun }: { tasks: UiTask[]; t: ReturnType<typeof createTranslator>; onOpenRun: (taskId: string) => void }) {
  return (
    <div className="view-panel task-list">
      {tasks.map((task) => (
        <button className="task-list-row as-button" type="button" key={task.id} onClick={() => onOpenRun(task.id)}>
          <div>
            <strong>{task.title}</strong>
            <span>{task.log[1]}</span>
          </div>
          <em>{task.done ? t("status.approved") : "待执行"}</em>
        </button>
      ))}
    </div>
  );
}

function ReviewsPanel({
  tasks,
  t,
  onOpenReview,
}: {
  tasks: UiTask[];
  t: ReturnType<typeof createTranslator>;
  onOpenReview: (taskId: string) => void;
}) {
  return (
    <div className="view-panel task-list">
      {tasks.map((task) => (
        <button className="task-list-row as-button" type="button" key={task.id} onClick={() => onOpenReview(task.id)}>
          <div>
            <strong>{task.title}</strong>
            <span>{task.review}</span>
          </div>
          <em className={task.verdict}>{statusLabel(task.verdict, t)}</em>
        </button>
      ))}
    </div>
  );
}

function GatePanel({
  completedCount,
  pendingCount,
  t,
  onOpenDecision,
}: {
  completedCount: number;
  pendingCount: number;
  t: ReturnType<typeof createTranslator>;
  onOpenDecision: () => void;
}) {
  return (
    <div className="view-panel">
      <div className="gate-large">
        <LockKeyhole size={34} />
        <div>
          <strong>{t("inspector.humanGate")}</strong>
          <span>{t("views.gateHint")}</span>
        </div>
      </div>
      <div className="overview-grid">
        <div className="summary-tile">
          <span>{t("status.approved")}</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="summary-tile">
          <span>待执行</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="summary-tile">
          <span>PR Gate</span>
          <strong>ON</strong>
          <button type="button" onClick={onOpenDecision}>
            查看决策
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  snapshot,
  providers,
  theme,
  t,
  onToggleTheme,
  onRefresh,
}: {
  snapshot: ProjectApiSnapshot | null;
  providers: AgentProvider[];
  theme: Theme;
  t: ReturnType<typeof createTranslator>;
  onToggleTheme: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="view-panel settings-grid">
      <section className="settings-section">
        <strong>{t("settings.project")}</strong>
        <dl className="meta-list">
          <div>
            <dt>Name</dt>
            <dd>{snapshot?.repo.name ?? "-"}</dd>
          </div>
          <div>
            <dt>Path</dt>
            <dd>{snapshot?.repo.path ?? "-"}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{snapshot?.repo.branch ?? "no-git"}</dd>
          </div>
        </dl>
        <button className="muted-button" type="button" onClick={onRefresh}>
          <RefreshCw size={14} />
          {t("actions.refresh")}
        </button>
      </section>
      <section className="settings-section">
        <strong>{t("settings.providers")}</strong>
        <div className="provider-list">
          {providers.map((provider) => (
            <div className={`provider-row ${provider.available ? "available" : "missing"}`} key={provider.id}>
              <span className="provider-logo">
                <ProviderBrandIcon providerId={provider.id} size={16} />
              </span>
              <span>{provider.label}</span>
              <em>{provider.available ? "available" : "missing"}</em>
            </div>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <strong>{t("settings.appearance")}</strong>
        <p>{theme === "dark" ? "当前是暗色主题，适合长时间编码。" : "当前是亮色主题，适合文档和白天审阅。"}</p>
        <div className="theme-setting-row">
          <span className="theme-control-icon">{theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}</span>
          <div>
            <strong>{theme === "dark" ? t("theme.dark") : t("theme.light")}</strong>
            <small>{t("theme.toggle")}</small>
          </div>
          <RadixSwitch.Root className="theme-switch" checked={theme === "dark"} aria-label="切换界面主题" onCheckedChange={() => onToggleTheme()}>
            <RadixSwitch.Thumb className="theme-switch-thumb" />
          </RadixSwitch.Root>
        </div>
      </section>
      <section className="settings-section">
        <strong>{t("settings.sdd")}</strong>
        <p>自动读取 OpenSpec、Spec Kit、根目录或子目录 tasks.md。未检测到 SDD 时保持真实空状态。</p>
      </section>
    </div>
  );
}

function TaskCard({ task, selected, onSelect, t }: { task: UiTask; selected: boolean; onSelect: () => void; t: ReturnType<typeof createTranslator> }) {
  return (
    <button className={`task-card ${selected ? "selected" : ""} ${providerClass[task.providerTone]}`} type="button" onClick={onSelect}>
      <div className="task-card-head">
        <strong>{task.title}</strong>
        <span>{task.type}</span>
      </div>
      <p>{task.description}</p>
      <div className="agent-pill">
        {task.providerLabel} · {task.providerState}
      </div>
      <dl>
        <div>
          <dt>{t("task.worktree")}</dt>
          <dd>{task.worktree}</dd>
        </div>
        <div>
          <dt>{t("task.progress")}</dt>
          <dd>{task.progress}%</dd>
        </div>
      </dl>
      <progress max="100" value={task.progress} />
      <div className="task-foot">
        <span>{task.sourcePath}</span>
        <span>{task.done ? "done" : "todo"}</span>
      </div>
    </button>
  );
}

function Inspector({
  task,
  t,
  completedCount,
  pendingCount,
  activeTab,
  actionOutput,
  onTabChange,
  onPreviewWorktree,
  onCreatePr,
}: {
  task: UiTask | null;
  t: ReturnType<typeof createTranslator>;
  completedCount: number;
  pendingCount: number;
  activeTab: InspectorTab;
  actionOutput: ActionOutput | null;
  onTabChange: (tab: InspectorTab) => void;
  onPreviewWorktree: () => void;
  onCreatePr: () => void;
}) {
  const tabs: Array<{ tab: InspectorTab; key: MessageKey }> = [
    { tab: "run", key: "inspector.run" },
    { tab: "diff", key: "inspector.diff" },
    { tab: "review", key: "inspector.review" },
    { tab: "decision", key: "inspector.decision" },
  ];

  if (!task) {
    return (
      <aside className="inspector">
        <RadixTabs.Root value={activeTab} onValueChange={(value) => onTabChange(value as InspectorTab)}>
          <RadixTabs.List className="inspector-tabs" aria-label="任务详情">
            {tabs.map(({ tab, key }) => (
              <RadixTabs.Trigger className={activeTab === tab ? "active" : ""} key={tab} value={tab}>
                {t(key)}
              </RadixTabs.Trigger>
            ))}
          </RadixTabs.List>
        </RadixTabs.Root>
        <div className="empty-state compact">
          <h2>等待真实任务</h2>
          <p>扫描到 OpenSpec、Spec Kit 或 tasks.md 后，这里会展示执行上下文。</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="inspector">
      <RadixTabs.Root value={activeTab} onValueChange={(value) => onTabChange(value as InspectorTab)}>
        <RadixTabs.List className="inspector-tabs" aria-label="任务详情">
          {tabs.map(({ tab, key }) => (
            <RadixTabs.Trigger className={activeTab === tab ? "active" : ""} key={tab} value={tab}>
              {t(key)}
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>
      </RadixTabs.Root>
      <section className="task-detail">
        <div className="detail-title">
          <div>
            <h2>{task.title}</h2>
            <span>{task.type}</span>
          </div>
          <strong className={`verdict ${task.verdict}`}>{statusLabel(task.verdict, t)}</strong>
        </div>
        <div className="detail-grid">
          <span>
            来源文件<strong>{task.sourcePath}</strong>
          </span>
          <span>
            {t("task.worktree")}
            <strong>{task.worktree}</strong>
          </span>
          <span>
            {t("task.implementer")}
            <strong>{task.providerLabel}</strong>
          </span>
          <span>
            {t("task.elapsed")}
            <strong>{task.elapsed}</strong>
          </span>
        </div>
      </section>
      {activeTab === "run" ? (
        <section className="terminal-panel">
          <div className="subhead">
            <strong>{t("inspector.realtimeLog")}</strong>
          </div>
          <pre>{task.log.join("\n")}</pre>
        </section>
      ) : null}
      {activeTab === "diff" ? (
        <section className="diff-panel">
          <div className="subhead">
            <strong>{t("inspector.diffPreview")}</strong>
            <span>{task.filesChanged} files changed</span>
          </div>
          <div className="diff-body">
            {task.diff.length === 0 ? <code>尚未执行，没有真实 Diff。</code> : task.diff.map((line) => <code key={line}>{line}</code>)}
          </div>
        </section>
      ) : null}
      {activeTab === "review" ? (
        <section className="review-panel">
          <strong>{t("inspector.reviewSummary")}</strong>
          <div className="review-row">
            <span className="dot tone-cyan" />
            <div>
              <b>真实扫描</b>
              <small>{task.review}</small>
            </div>
            <em className={task.verdict}>{statusLabel(task.verdict, t)}</em>
          </div>
        </section>
      ) : null}
      {activeTab === "decision" ? (
        <section className="decision-panel">
          <div>
            <strong>{t("inspector.crossVerdict")}</strong>
            <span>
              {completedCount} 已完成 · {pendingCount} 待执行
            </span>
          </div>
          {actionOutput ? (
            <div className="action-output">
              <strong>{actionOutput.title}</strong>
              <pre>{actionOutput.body.join("\n")}</pre>
            </div>
          ) : (
            <div className="action-output muted">选择下方操作后，这里会显示真实命令预览或阻塞原因。</div>
          )}
          <div className="decision-actions">
            <button className="secondary" type="button" onClick={onPreviewWorktree}>
              <CircleAlert size={16} />
              {t("actions.previewWorktree")}
            </button>
            <button className="primary" type="button" onClick={onCreatePr}>
              <GitPullRequestArrow size={16} />
              {t("actions.createPr")}
            </button>
          </div>
        </section>
      ) : null}
    </aside>
  );
}
