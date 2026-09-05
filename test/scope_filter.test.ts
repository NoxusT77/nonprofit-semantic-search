import test from "node:test";
import assert from "node:assert/strict";
import { scopeFilter, searchRequest } from "../src/nonprofit_records.ts";

test("a volunteer asking about donations never gets donor receipts in scope", () => {
  const req = searchRequest.parse({ query: "who gave to winter meals in January", role: "volunteer" });
  const filter = scopeFilter(req);
  assert.deepEqual(filter.kind.$in, ["volunteer_reminder"]);
  assert.equal(filter.program, undefined);
});

test("finance can reach receipts, and a program narrows the filter", () => {
  const req = searchRequest.parse({ query: "January receipts", role: "finance", program: "winter-meals", limit: 3 });
  const filter = scopeFilter(req);
  assert.ok(filter.kind.$in.includes("donor_receipt"));
  assert.equal(filter.program, "winter-meals");
  assert.equal(req.limit, 3);
});

test("a program lead sees reminders and reports but not receipts", () => {
  const req = searchRequest.parse({ query: "how did tutoring retention look", role: "program_lead" });
  assert.deepEqual(scopeFilter(req).kind.$in, ["volunteer_reminder", "campaign_report"]);
});

test("an unknown role is rejected at the request boundary", () => {
  const parsed = searchRequest.safeParse({ query: "anything at all", role: "board_member" });
  assert.equal(parsed.success, false);
});
