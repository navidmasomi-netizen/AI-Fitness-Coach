function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const { createRestDeadline, getRestSecondsRemaining, resumeRestDeadline } = (await (0, eval)(
    'import("./restTimer.ts")'
  )) as typeof import("./restTimer");
  const start = 1_000_000;
  const deadline = createRestDeadline(60, start);

  assertEqual(deadline, start + 60_000, "Rest should store an absolute deadline");
  assertEqual(getRestSecondsRemaining(deadline, start), 60, "A new rest should show its full duration");
  assertEqual(
    getRestSecondsRemaining(deadline, start + 15_100),
    45,
    "Foreground reconciliation should derive remaining time from the deadline"
  );
  assertEqual(
    getRestSecondsRemaining(deadline, start + 61_000),
    0,
    "A rest that expires in the background should resolve immediately"
  );
  assertEqual(
    getRestSecondsRemaining(deadline, start + 600_000),
    0,
    "Remaining rest should never become negative"
  );
  assertEqual(
    resumeRestDeadline(20, start + 10_000),
    start + 30_000,
    "Resuming a paused rest should create a fresh deadline from its remaining time"
  );
  assertEqual(resumeRestDeadline(0, start), null, "Completed rest cannot be resumed");

  console.log("Rest timer deadline contract: 7 passed");
}

void main();
