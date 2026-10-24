import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, loadPolicy, record } from "../lib/policy.js";
import { buttonLabel, demoRequests, filledSentence } from "../public/demo.js";

const policy = loadPolicy();
const burn = "0x000000000000000000000000000000000000dEaD";
const stranger = "0x0000000000000000000000000000000000000001";
const noon = new Date("2026-10-23T12:00:00Z");

test("a request inside every rule is allowed and not executed", () => {
  const out = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "12:00" }, noon);
  assert.equal(out.decision, "allow");
  assert.equal(out.rule, "spend limit, allowlist, time window");
  assert.equal(out.executed, false);
});

test("the limit and the window edges are included", () => {
  assert.equal(evaluate(policy, { amount: "100", token: "USDC", to: burn, at: "09:00" }, noon).decision, "allow");
  assert.equal(evaluate(policy, { amount: "100", token: "USDC", to: burn, at: "21:00" }, noon).decision, "allow");
  assert.equal(evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "08:59" }, noon).rule, "time window");
  assert.equal(evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "21:01" }, noon).rule, "time window");
  assert.equal(evaluate(policy, { amount: "100.01", token: "USDC", to: burn, at: "12:00" }, noon).rule, "spend limit");
});

test("an amount over the limit is denied by the spend rule", () => {
  const out = evaluate(policy, { amount: "500", token: "USDC", to: burn, at: "12:00" }, noon);
  assert.equal(out.decision, "deny");
  assert.equal(out.rule, "spend limit");
  assert.equal(out.executed, false);
  assert.equal(out.reason, "500 USDC is over 100.");
});

test("an unreadable clock is denied and is not rolled forward", () => {
  const rolled = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "12:60" }, noon);
  assert.equal(rolled.decision, "deny");
  assert.equal(rolled.rule, "time window");
  assert.equal(rolled.reason, "12:60 is not a UTC time.");
  assert.equal(rolled.entry.clock, "12:60");
  assert.equal(rolled.entry.at, null);
  assert.equal(rolled.executed, false);
  const day = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "24:00" }, noon);
  assert.equal(day.reason, "24:00 is not a UTC time.");
  assert.equal(day.entry.clock, "24:00");
});

test("a timestamp without a zone is read as UTC", () => {
  const plain = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "2026-10-23T12:00:00" }, noon);
  assert.equal(plain.decision, "allow");
  assert.equal(plain.entry.clock, "12:00 UTC");
  const zoned = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "2026-10-23T12:00:00-03:00" }, noon);
  assert.equal(zoned.entry.clock, "15:00 UTC");
  const dateOnly = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "2026-10-23" }, noon);
  assert.equal(dateOnly.rule, "time window");
  assert.equal(dateOnly.reason, "2026-10-23 is not a UTC time.");
  assert.equal(dateOnly.entry.clock, "2026-10-23");
});

test("9:00 is the same minute as 09:00 and zero is under the limit", () => {
  const early = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "9:00" }, noon);
  assert.equal(early.decision, "allow");
  assert.equal(early.entry.clock, "09:00 UTC");
  const zero = evaluate(policy, { amount: "0", token: "USDC", to: burn, at: "12:00" }, noon);
  assert.equal(zero.decision, "allow");
});

test("an unreadable amount is not described as over the limit", () => {
  for (const amount of ["", "1e2", "-1", "100,5", "100."]) {
    const out = evaluate(policy, { amount, token: "USDC", to: burn, at: "12:00" }, noon);
    assert.equal(out.rule, "spend limit");
    assert.equal(out.executed, false);
    assert.doesNotMatch(out.reason, /over/);
  }
  const empty = evaluate(policy, { amount: "", token: "USDC", to: burn, at: "12:00" }, noon);
  assert.equal(empty.reason, "empty is not a USDC amount.");
  assert.equal(empty.entry.action, `— USDC to ${burn}`);
});

test("the sample wallet is allowlisted and the four demos each hit one result", () => {
  const sample = "0x15dDce897D76ac39c188AdE4D353711A60395315";
  assert.equal(evaluate(policy, { amount: "10", token: "USDC", to: sample, at: "12:00" }, noon).decision, "allow");
  const demos = demoRequests(policy);
  assert.equal(evaluate(policy, demos.allow, noon).decision, "allow");
  assert.equal(evaluate(policy, demos.spend, noon).rule, "spend limit");
  assert.equal(evaluate(policy, demos.list, noon).rule, "allowlist");
  assert.equal(evaluate(policy, demos.time, noon).rule, "time window");
  assert.equal(demos.spend.amount, "101");
  assert.equal(demos.time.at, "08:59");
  assert.equal(filledSentence(demos.allow, "en"), `10 USDC to ${burn} at 12:00`);
  assert.equal(filledSentence(demos.spend, "pt"), `101 USDC para ${burn} às 12:00`);
  assert.equal(buttonLabel(demos.allow, "allow", "en"), "10 USDC at 12:00");
  assert.equal(buttonLabel(demos.spend, "spend", "en"), "101 USDC");
  assert.equal(buttonLabel(demos.list, "list", "en"), "off the list");
  assert.equal(buttonLabel(demos.time, "time", "en"), "08:59");
  assert.equal(buttonLabel(demos.list, "list", "pt"), "fora da lista");
});

test("an address off the list is denied by the allowlist", () => {
  const out = evaluate(policy, { amount: "10", token: "USDC", to: stranger, at: "12:00" }, noon);
  assert.equal(out.decision, "deny");
  assert.equal(out.rule, "allowlist");
});

test("a time outside the window is denied by the time rule", () => {
  const out = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "03:00" }, noon);
  assert.equal(out.decision, "deny");
  assert.equal(out.rule, "time window");
  assert.match(out.reason, /03:00 UTC/);
});

test("the first failing rule is the one that decides", () => {
  const out = evaluate(policy, { amount: "500", token: "USDC", to: stranger, at: "03:00" }, noon);
  assert.equal(out.rule, "time window");
});

test("every decision is appended to the audit log", () => {
  const first = evaluate(policy, { amount: "500", token: "USDC", to: burn, at: "12:00" }, noon);
  const second = evaluate(policy, { amount: "10", token: "USDC", to: burn, at: "12:00" }, noon);
  const log = record(record([], first.entry), second.entry);
  assert.equal(log.length, 2);
  assert.equal(log[0].decision, "deny");
  assert.equal(log[1].decision, "allow");
  assert.equal(log[0].executed, false);
});
