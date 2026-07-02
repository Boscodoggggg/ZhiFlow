import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT ?? 5173);
const projectPath = resolve(process.env.ZHIFLOW_PROJECT ?? root);

const vite = await createViteServer({
  root,
  server: {
    middlewareMode: true,
    hmr: { port: port + 1 },
  },
  appType: "spa",
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

  if (url.pathname === "/api/project") {
    try {
      const module = await vite.ssrLoadModule("/src/projectScanner.ts");
      const providerModule = await vite.ssrLoadModule("/src/providerDetector.ts");
      const snapshot = await module.scanProject(projectPath);
      const providers = await providerModule.detectLocalProviders();
      sendJson(res, 200, { ...snapshot, providers });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
        projectPath,
      });
    }
    return;
  }

  vite.middlewares(req, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ZhiFlow Lite: http://127.0.0.1:${port}/`);
  console.log(`Project: ${projectPath}`);
});

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload)}\n`);
}
