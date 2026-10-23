import { loadPolicy } from "../lib/policy.js";

const policy = loadPolicy();

export default function handler(req, res) {
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  }).end(JSON.stringify(policy));
}
