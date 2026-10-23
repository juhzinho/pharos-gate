import { setMode } from "./scene.js";
import { demoRequests, filledSentence } from "./demo.js";

const KEY = "pharos-gate-log";
const I = {
  en: {
    kicker: "Policy · allow or deny · nothing executed",
    title: "Check it. Then stop.",
    lead: "Spend limit, allowlist and time window. The first rule that fails is the one that decides. A denied action is not executed.",
    amountL: "Amount", tokenL: "Token", toL: "To", atL: "Check at (UTC)", go: "Check",
    log: "Audit log",
    missing: "The check did not return a decision.",
    unread: "The policy file could not be read.",
  },
  pt: {
    kicker: "Política · permite ou nega · nada executado",
    title: "Confere. Depois para.",
    lead: "Limite de gasto, lista e horário. A primeira regra que falha é a que decide. Uma ação negada não é executada.",
    amountL: "Valor", tokenL: "Token", toL: "Para", atL: "Conferir às (UTC)", go: "Conferir",
    log: "Registro",
    missing: "A conferência não devolveu uma decisão.",
    unread: "O arquivo da política não pôde ser lido.",
  },
};
let lang = localStorage.getItem("pharos-lang") === "pt" ? "pt" : "en";
let policy = null;
let examples = null;
let touched = false;
let log = loadLog();
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

function loadLog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function isEntry(entry) {
  return !!entry && (entry.decision === "allow" || entry.decision === "deny") && entry.rule && entry.executed === false;
}

function ruleLines(file) {
  const list = (file.allowlist ?? []).join(" · ");
  const limit = file.spendLimit ?? {};
  const window = file.timeWindow ?? {};
  if (lang === "pt") {
    return [
      `Limite: ${limit.max} ${limit.token}`,
      `Lista: ${list}`,
      `Horário: ${window.from}–${window.to} ${window.timezone}`,
    ];
  }
  return [
    `Spend limit: ${limit.max} ${limit.token}`,
    `Allowlist: ${list}`,
    `Time window: ${window.from}–${window.to} ${window.timezone}`,
  ];
}

function apply() {
  const t = I[lang];
  document.documentElement.lang = lang;
  $("kicker").textContent = t.kicker;
  $("title").textContent = t.title;
  $("lead").textContent = t.lead;
  $("amountL").textContent = t.amountL;
  $("tokenL").textContent = t.tokenL;
  $("toL").textContent = t.toL;
  $("atL").textContent = t.atL;
  $("go").textContent = t.go;
  $("logLabel").textContent = t.log;
  $("rules").innerHTML = policy ? ruleLines(policy).map((line) => `<span>${esc(line)}</span>`).join("") : "";
  if (examples) {
    for (const key of ["allow", "spend", "list", "time"]) $(key).textContent = filledSentence(examples[key], lang);
  }
  document.querySelectorAll("[data-lang]").forEach((button) => button.classList.toggle("on", button.dataset.lang === lang));
  paint();
}

function paint() {
  $("log").innerHTML = "";
  for (const entry of [...log].reverse()) {
    if (!isEntry(entry)) continue;
    const node = document.createElement("div");
    node.className = `msg ${entry.decision}`;
    node.innerHTML = `<b>${esc(entry.decision)} · ${esc(entry.rule)}</b><p>${esc(entry.action)}</p><div class="detail">${esc(entry.reason)} · ${esc(entry.clock)} · executed ${esc(entry.executed)}</div>`;
    $("log").append(node);
  }
  setMode(log.at(-1)?.decision || "wait");
}

function note(text) {
  $("status").textContent = text;
}

async function check(fields) {
  const q = new URLSearchParams({ lang, ...fields });
  $("go").disabled = true;
  setMode("wait");
  note("");
  try {
    const res = await fetch("/api/gate?" + q);
    const data = await res.json();
    if (!isEntry(data?.entry) || data.decision !== data.entry.decision || data.rule !== data.entry.rule || data.executed !== false) {
      note(I[lang].missing);
      setMode("deny");
      return;
    }
    log = [...log, data.entry];
    try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { /* the decision still stays on screen */ }
    paint();
  } catch {
    note(I[lang].missing);
    setMode("deny");
  } finally {
    $("go").disabled = false;
  }
}

function fields() {
  return { amount: $("amount").value.trim(), token: $("token").value.trim(), to: $("to").value.trim(), at: $("at").value.trim() };
}

function fill(row) {
  $("amount").value = row.amount;
  $("token").value = row.token;
  $("to").value = row.to;
  $("at").value = row.at;
}

$("form").addEventListener("submit", (event) => {
  event.preventDefault();
  check(fields());
});
$("form").addEventListener("input", () => { touched = true; });
$("chips").addEventListener("click", (event) => {
  const button = event.target.closest("[data-ex]");
  if (!button || !examples) return;
  fill(examples[button.dataset.ex]);
});
document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => { lang = button.dataset.lang; localStorage.setItem("pharos-lang", lang); apply(); });
});

apply();
fetch("/api/policy")
  .then((res) => res.json())
  .then((file) => {
    if (!file?.spendLimit || !Array.isArray(file.allowlist) || !file.timeWindow) throw new Error("policy");
    policy = file;
    examples = demoRequests(file);
    if (!touched) fill(examples.allow);
    apply();
  })
  .catch(() => note(I[lang].unread));
