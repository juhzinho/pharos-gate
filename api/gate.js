import { evaluate, loadPolicy } from "../lib/policy.js";

const policy = loadPolicy();

export default function handler(req, res) {
  const q = new URL(req.url, "http://localhost").searchParams;
  const lang = q.get("lang") === "pt" ? "pt" : "en";
  const out = evaluate(policy, {
    amount: q.get("amount") || "",
    token: q.get("token") || "",
    to: q.get("to") || "",
    at: q.get("at") || "",
  }, new Date(), lang);
  res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(out));
}
