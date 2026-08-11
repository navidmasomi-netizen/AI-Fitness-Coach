let structuredLogSink = null;

function writeStructuredLog(level, entry) {
  if (structuredLogSink) {
    structuredLogSink(level, entry);
    return;
  }

  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.info(serialized);
}

export function logStructuredEvent(level, event, fields = {}) {
  writeStructuredLog(level, {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
}

export function __setStructuredLogSinkForTest(nextSink) {
  structuredLogSink = nextSink;
}
