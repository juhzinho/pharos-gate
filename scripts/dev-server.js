import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import gate from "../api/gate.js";
import policy from "../api/policy.js";

const PORT = Number(process.env.PORT ?? 3030);
const ROOT = fileURLToPath(new URL("../public/", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

http
  .createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/api/gate") return gate(req, res);
    if (pathname === "/api/policy") return policy(req, res);
    if (pathname === "/policy.json") {
      const body = await readFile(fileURLToPath(new URL("../policy.json", import.meta.url)));
      return res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(body);
    }
    const file = normalize(pathname === "/" ? "index.html" : pathname.slice(1));
    if (file.startsWith("..")) return res.writeHead(403).end();
    try {
      const body = await readFile(join(ROOT, file));
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}`));
