#!/usr/bin/env node
import { appendFile, mkdir } from "node:fs/promises";
import { evaluate, loadPolicy } from "../../lib/policy.js";

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : "";
}

const policy = loadPolicy();
const out = evaluate(policy, {
  amount: flag("--amount"),
  token: flag("--token") || "USDC",
  to: flag("--to"),
  at: flag("--at"),
}, new Date(), flag("--lang") === "pt" ? "pt" : "en");

console.log(out.headline);
console.log(`${out.decision} · ${out.rule}`);
console.log(out.reason);
console.log("executed false");

await mkdir(new URL("../../data/", import.meta.url), { recursive: true });
await appendFile(new URL("../../data/audit.jsonl", import.meta.url), JSON.stringify(out.entry) + "\n");
