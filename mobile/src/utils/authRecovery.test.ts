function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const { getErrorStatus, getProfileLoadErrorMessage, isUnauthorizedError } = (await (0, eval)(
    'import("./authRecovery.ts")'
  )) as typeof import("./authRecovery");

  assertEqual(isUnauthorizedError({ status: 401 }), true, "401 should invalidate authentication");
  assertEqual(isUnauthorizedError({ status: 0 }), false, "Network failures must preserve authentication");
  assertEqual(isUnauthorizedError({ status: 500 }), false, "Server failures must preserve authentication");
  assertEqual(getErrorStatus(new Error("offline")), null, "Unstructured errors should not be treated as auth failures");
  assertEqual(
    getProfileLoadErrorMessage({ status: 0 }),
    "We couldn't reach the server. Check your connection and try again.",
    "Network failures should expose a recoverable message"
  );
  assertEqual(
    getProfileLoadErrorMessage({ status: 500 }),
    "The server is temporarily unavailable. Please try again.",
    "5xx failures should expose a recoverable message"
  );

  console.log("Auth recovery classification: 6 passed");
}

void main();
