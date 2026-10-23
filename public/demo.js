function minutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function amountInside(max) {
  const text = String(max ?? "");
  if (!/^\d+(\.\d+)?$/.test(text)) return "0";
  const [whole, frac = ""] = text.split(".");
  const ten = BigInt(10 + "".padEnd(frac.length, "0"));
  const limit = BigInt(whole + frac.padEnd(frac.length, "0"));
  if (limit >= ten) return "10";
  return text;
}

function amountAbove(max) {
  const text = String(max ?? "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return "1";
  const frac = match[2] ?? "";
  const digits = BigInt(match[1] + frac) + 1n;
  const raw = digits.toString().padStart(frac.length + 1, "0");
  if (!frac) return raw.replace(/^0+(?=\d)/, "");
  const whole = raw.slice(0, -frac.length).replace(/^0+(?=\d)/, "") || "0";
  return `${whole}.${raw.slice(-frac.length)}`;
}

function clockInside(window) {
  const from = minutes(window.from);
  const to = minutes(window.to);
  const noon = 12 * 60;
  if (from != null && to != null && noon >= from && noon <= to) return "12:00";
  return window.from || "00:00";
}

function clockBefore(from) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(from ?? ""));
  if (!match) return "00:00";
  let total = Number(match[1]) * 60 + Number(match[2]) - 1;
  if (total < 0) total = 23 * 60 + 59;
  const hour = String(Math.floor(total / 60)).padStart(2, "0");
  const minute = String(total % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function offList(list) {
  const known = new Set((list ?? []).map((item) => String(item).toLowerCase()));
  for (let i = 1; i <= 9; i += 1) {
    const candidate = `0x${"0".repeat(39)}${i}`;
    if (!known.has(candidate)) return candidate;
  }
  return "0x0000000000000000000000000000000000000001";
}

export function demoRequests(policy) {
  const listed = String(policy.allowlist?.[0] ?? "");
  const token = String(policy.spendLimit?.token ?? "");
  const max = String(policy.spendLimit?.max ?? "");
  const at = clockInside(policy.timeWindow ?? {});
  const amount = amountInside(max);
  return {
    allow: { amount, token, to: listed, at },
    spend: { amount: amountAbove(max), token, to: listed, at },
    list: { amount, token, to: offList(policy.allowlist), at },
    time: { amount, token, to: listed, at: clockBefore(policy.timeWindow?.from) },
  };
}

export function filledSentence(row, lang) {
  return lang === "pt"
    ? `${row.amount} ${row.token} para ${row.to} às ${row.at}`
    : `${row.amount} ${row.token} to ${row.to} at ${row.at}`;
}
