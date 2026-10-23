import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const bundledPolicy = require("../policy.json");

export function loadPolicy(path) {
  if (!path) return bundledPolicy;
  return JSON.parse(readFileSync(path, "utf8"));
}

function minutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function clock(date) {
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function compareAmount(left, right) {
  const [ai, af = ""] = String(left).split(".");
  const [bi, bf = ""] = String(right).split(".");
  if (!/^\d+$/.test(ai) || !/^\d+$/.test(bi) || (af && !/^\d+$/.test(af)) || (bf && !/^\d+$/.test(bf))) return null;
  const width = Math.max(af.length, bf.length);
  const av = BigInt(ai + af.padEnd(width, "0"));
  const bv = BigInt(bi + bf.padEnd(width, "0"));
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function say(lang, pack) {
  return lang === "pt" ? pack.pt : pack.en;
}

function result(lang, decision, rule, reason, request, at) {
  const entry = {
    at: at.toISOString(),
    clock: `${clock(at)} UTC`,
    decision,
    rule,
    action: `${request.amount} ${request.token} to ${request.to}`,
    reason,
    executed: false,
  };
  return {
    ok: true,
    decision,
    rule,
    reason,
    executed: false,
    headline: decision === "allow"
      ? say(lang, { pt: "Permitido.", en: "Allowed." })
      : say(lang, { pt: "Negado.", en: "Denied." }),
    entry,
  };
}

function resolveAt(value, now) {
  const text = String(value ?? "").trim();
  if (!text) return now;
  const hm = /^(\d{2}):(\d{2})$/.exec(text);
  if (hm) {
    const at = new Date(now);
    at.setUTCHours(Number(hm[1]), Number(hm[2]), 0, 0);
    return at;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function evaluate(policy, request, now = new Date(), lang = "en") {
  const at = resolveAt(request.at, now);
  if (!at) {
    return result(lang, "deny", "time window", say(lang, {
      pt: "Esse horário não fecha.",
      en: "That clock time could not be read.",
    }), {
      amount: String(request.amount ?? "").trim(),
      token: String(request.token ?? "").trim(),
      to: String(request.to ?? "").trim(),
    }, now);
  }
  const when = at;
  const amount = String(request.amount ?? "").trim();
  const token = String(request.token ?? "").trim();
  const to = String(request.to ?? "").trim();
  const asked = { amount, token, to };

  const window = policy.timeWindow ?? {};
  const from = minutes(window.from);
  const toMin = minutes(window.to);
  const nowMin = when.getUTCHours() * 60 + when.getUTCMinutes();
  const inside = from != null && toMin != null && from <= toMin && nowMin >= from && nowMin <= toMin;
  if (!inside) {
    return result(lang, "deny", "time window", say(lang, {
      pt: `${clock(when)} UTC está fora de ${window.from}–${window.to} UTC.`,
      en: `${clock(when)} UTC is outside ${window.from}–${window.to} UTC.`,
    }), asked, when);
  }

  const allowed = (policy.allowlist ?? []).map((item) => item.toLowerCase());
  if (!/^0x[a-fA-F0-9]{40}$/.test(to) || !allowed.includes(to.toLowerCase())) {
    return result(lang, "deny", "allowlist", say(lang, {
      pt: "Esse endereço não está na lista.",
      en: "That address is not on the allowlist.",
    }), asked, when);
  }

  const limit = policy.spendLimit ?? {};
  const order = compareAmount(amount, limit.max);
  if (token.toUpperCase() !== String(limit.token ?? "").toUpperCase() || order == null || order > 0) {
    const why = token.toUpperCase() !== String(limit.token ?? "").toUpperCase()
      ? { pt: `O limite é de ${limit.token}, não de ${token || "outro token"}.`, en: `The limit is for ${limit.token}, not ${token || "another token"}.` }
      : { pt: `${amount || "0"} ${limit.token} passa de ${limit.max}.`, en: `${amount || "0"} ${limit.token} is over ${limit.max}.` };
    return result(lang, "deny", "spend limit", say(lang, why), asked, when);
  }

  return result(lang, "allow", "spend limit, allowlist, time window", say(lang, {
    pt: "Limite, lista e horário passaram. Nada foi executado.",
    en: "Spend limit, allowlist and time window passed. Nothing was executed.",
  }), asked, when);
}

export function record(log, entry) {
  return [...(log ?? []), entry];
}
