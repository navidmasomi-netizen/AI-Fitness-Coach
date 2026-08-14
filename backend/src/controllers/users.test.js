import assert from "node:assert/strict";

import { createUser, normalizeRequiredName } from "./users.js";

function createResponse() {
  const result = { statusCode: null, body: null };
  return {
    result,
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
}

async function assertRejectedName(name) {
  const res = createResponse();
  await createUser({ body: { email: "athlete@example.com", name, password: "password" } }, res);
  assert.equal(res.result.statusCode, 400);
  assert.equal(res.result.body.message, "Name, email and password are required");
}

assert.equal(normalizeRequiredName("Ada Lovelace"), "Ada Lovelace");
assert.equal(normalizeRequiredName("  Ada Lovelace  "), "Ada Lovelace");
assert.equal(normalizeRequiredName(undefined), null);
assert.equal(normalizeRequiredName(""), null);
assert.equal(normalizeRequiredName("   \t\n"), null);

await assertRejectedName(undefined);
await assertRejectedName("");
await assertRejectedName("   \t\n");

console.log("Registration name validation: 8 passed");
