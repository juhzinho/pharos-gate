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
  const a = String(left);
  const b = String(right);
  if (!/^\d+(\.\d+)?$/.test(a) || !/^\d+(\.\d+)?$/.test(b)) return null;
  const [ai, af = ""] = a.split(".");
  const [bi, bf = ""] = b.split(".");
  const width = Math.max(af.length, bf.length);
  const av = BigInt(ai + af.padEnd(width, "0"));
  const bv = BigInt(bi + bf.padEnd(width, "0"));
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function say(lang, pack) {
  return lang === "pt" ? pack.pt : pack.en;
}

function result(lang, decision, rule, reason, request, at, clockLabel) {
  const entry = {
    at: at ? at.toISOString() : null,
    clock: clockLabel ?? `${clock(at)} UTC`,
    decision,
    rule,
    action: `${request.amount || "—"} ${request.token || "—"} to ${request.to || "—"}`,
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
  if (!text) return { date: new Date(now) };
  const hm = /^(\d{1,2}):(\d{1,2})$/.exec(text);
  if (hm) {
    const hour = Number(hm[1]);
    const minute = Number(hm[2]);
    if (hour > 23 || minute > 59) return { invalid: text };
    const at = new Date(now);
    at.setUTCHours(hour, minute, 0, 0);
    return { date: at };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(text);
  if (!iso) return { invalid: text };
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  const hour = Number(iso[4]);
  const minute = Number(iso[5]);
  const second = Number(iso[6] ?? "0");
  const fraction = Number(String(iso[7] ?? "0").padEnd(3, "0"));
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return { invalid: text };
  if (iso[8]) {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return { invalid: text };
    return { date: parsed };
  }
  const at = new Date(Date.UTC(year, month - 1, day, hour, minute, second, fraction));
  if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return { invalid: text };
  return { date: at };
}

export function evaluate(policy, request, now = new Date(), lang = "en") {
  const amount = String(request.amount ?? "").trim();
  const token = String(request.token ?? "").trim();
  const to = String(request.to ?? "").trim();
  const asked = { amount, token, to };
  const resolved = resolveAt(request.at, now);
  if (resolved.invalid) {
    return result(lang, "deny", "time window", say(lang, {
      pt: `${resolved.invalid} não é um horário UTC.`,
      en: `${resolved.invalid} is not a UTC time.`,
    }), asked, null, resolved.invalid);
  }
  const when = resolved.date;

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
  const sameToken = token.toUpperCase() === String(limit.token ?? "").toUpperCase();
  const order = compareAmount(amount, limit.max);
  if (!sameToken || order == null || order > 0) {
    const why = !sameToken
      ? { pt: `O limite é de ${limit.token}, não de ${token || "outro token"}.`, en: `The limit is for ${limit.token}, not ${token || "another token"}.` }
      : order == null
        ? { pt: `${amount || "vazio"} não é um valor em ${limit.token}.`, en: `${amount || "empty"} is not a ${limit.token} amount.` }
        : { pt: `${amount} ${limit.token} passa de ${limit.max}.`, en: `${amount} ${limit.token} is over ${limit.max}.` };
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
