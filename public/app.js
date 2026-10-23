import { setMode } from "./scene.js";

const BURN = "0x000000000000000000000000000000000000dEaD";
const STRANGER = "0x0000000000000000000000000000000000000001";
const KEY = "pharos-gate-log";
const I = {
  en: {
    kicker: "Policy · allow or deny · nothing executed",
    title: "Check it. Then stop.",
    lead: "Spend limit, allowlist and time window. The first rule that fails is the one that decides. A denied action is not executed.",
    rules: ["Spend limit: 100 USDC", "Allowlist: burn address and the public sample wallet", "Time window: 09:00–21:00 UTC"],
    amountL: "Amount", tokenL: "Token", toL: "To", atL: "Check at (UTC)", go: "Check",
    chips: { allow: "allow", spend: "over the limit", list: "off the list", time: "outside hours" },
  },
  pt: {
    kicker: "Política · permite ou nega · nada executado",
    title: "Confere. Depois para.",
    lead: "Limite de gasto, lista e horário. A primeira regra que falha é a que decide. Uma ação negada não é executada.",
    rules: ["Limite: 100 USDC", "Lista: endereço de queima e a carteira pública de exemplo", "Horário: 09:00–21:00 UTC"],
    amountL: "Valor", tokenL: "Token", toL: "Para", atL: "Conferir às (UTC)", go: "Conferir",
    chips: { allow: "permite", spend: "passa do limite", list: "fora da lista", time: "fora do horário" },
  },
};
const EXAMPLES = {
  allow: { amount: "10", token: "USDC", to: BURN, at: "12:00" },
  spend: { amount: "500", token: "USDC", to: BURN, at: "12:00" },
  list: { amount: "10", token: "USDC", to: STRANGER, at: "12:00" },
  time: { amount: "10", token: "USDC", to: BURN, at: "03:00" },
};
let lang = localStorage.getItem("pharos-lang") === "pt" ? "pt" : "en";
let log = JSON.parse(localStorage.getItem(KEY) || "[]");
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

function apply() {
  const t = I[lang];
  document.documentElement.lang = lang;
  $("kicker").textContent = t.kicker;
  $("title").textContent = t.title;
  $("lead").textContent = t.lead;
  $("rules").innerHTML = t.rules.map((line) => `<span>${esc(line)}</span>`).join("");
  $("amountL").textContent = t.amountL;
  $("tokenL").textContent = t.tokenL;
  $("toL").textContent = t.toL;
  $("atL").textContent = t.atL;
  $("go").textContent = t.go;
  for (const key of ["allow", "spend", "list", "time"]) $(key).textContent = t.chips[key];
  document.querySelectorAll("[data-lang]").forEach((button) => button.classList.toggle("on", button.dataset.lang === lang));
  paint();
}

function paint() {
  $("log").innerHTML = "";
  for (const entry of [...log].reverse()) {
    const node = document.createElement("div");
    node.className = `msg ${entry.decision}`;
    node.innerHTML = `<b>${esc(entry.decision)} · ${esc(entry.rule)}</b><p>${esc(entry.action)}</p><div class="detail">${esc(entry.reason)} · ${esc(entry.clock)} · executed false</div>`;
    $("log").append(node);
  }
  setMode(log.at(-1)?.decision || "wait");
}

async function check(fields) {
  const q = new URLSearchParams({ lang, ...fields });
  $("go").disabled = true;
  setMode("wait");
  try {
    const res = await fetch("/api/gate?" + q);
    const data = await res.json();
    log = [...log, data.entry];
    localStorage.setItem(KEY, JSON.stringify(log));
    paint();
  } catch (error) {
    setMode("deny");
  } finally {
    $("go").disabled = false;
  }
}

function fields() {
  return { amount: $("amount").value.trim(), token: $("token").value.trim(), to: $("to").value.trim(), at: $("at").value.trim() };
}

$("form").addEventListener("submit", (event) => {
  event.preventDefault();
  check(fields());
});
$("chips").addEventListener("click", (event) => {
  const button = event.target.closest("[data-ex]");
  if (!button) return;
  const row = EXAMPLES[button.dataset.ex];
  $("amount").value = row.amount;
  $("token").value = row.token;
  $("to").value = row.to;
  $("at").value = row.at;
});
document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => { lang = button.dataset.lang; localStorage.setItem("pharos-lang", lang); apply(); });
});
apply();
