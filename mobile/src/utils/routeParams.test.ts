function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

async function main() {
  const {
    getPositiveRouteId,
    getRequiredRouteString,
    parseOptionalRouteArray,
    parseRequiredRouteArray,
  } = (await (0, eval)('import("./routeParams.ts")')) as typeof import("./routeParams");
  const isString = (value: unknown): value is string => typeof value === "string";

  assertEqual(getPositiveRouteId("42"), 42, "A valid positive route id should parse");
  assertEqual(getPositiveRouteId(undefined), null, "A missing route id should be rejected");
  assertEqual(getPositiveRouteId("abc"), null, "A malformed route id should be rejected");
  assertEqual(getPositiveRouteId("Infinity"), null, "An infinite route id should be rejected");
  assertEqual(getPositiveRouteId("-1"), null, "A negative route id should be rejected");
  assertEqual(getPositiveRouteId(["42"]), null, "An array-valued route id should be rejected");
  assertEqual(getRequiredRouteString("Workout A"), "Workout A", "A scalar route string should be preserved");
  assertEqual(getRequiredRouteString(["Workout A"]), null, "An array-valued route string should be rejected");
  assertDeepEqual(
    parseRequiredRouteArray('["Squat", "Row"]', isString),
    ["Squat", "Row"],
    "A valid serialized string array should parse"
  );
  assertEqual(parseRequiredRouteArray("{", isString), null, "Malformed JSON should be rejected");
  assertEqual(parseRequiredRouteArray("null", isString), null, "Null JSON should be rejected");
  assertDeepEqual(
    parseRequiredRouteArray("[]", isString),
    [],
    "An empty array remains available for route-specific contract validation"
  );
  assertEqual(parseRequiredRouteArray(["[]"], isString), null, "Array-valued JSON params should be rejected");
  assertDeepEqual(
    parseOptionalRouteArray(undefined, isString),
    [],
    "An omitted optional array should use its explicit empty default"
  );

  console.log("Route parameter parsing: 14 passed");
}

void main();
