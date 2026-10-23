import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, loadPolicy, record } from "../lib/policy.js";

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
