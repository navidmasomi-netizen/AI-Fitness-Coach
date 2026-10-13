function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const { getHydratedSupplementOther } = (await (0, eval)(
    'import("./supplementOther.ts")'
  )) as typeof import("./supplementOther");

  assertEqual(
    getHydratedSupplementOther({ supplementOther: "Creatine and electrolytes" }),
    "Creatine and electrolytes",
    "Hydration should restore a saved other-supplement value"
  );
  assertEqual(
    getHydratedSupplementOther({ supplementOther: null }),
    null,
    "Legacy profiles with a null value should remain safe"
  );
  assertEqual(
    getHydratedSupplementOther({}),
    null,
    "Legacy profiles without the field should remain safe"
  );
  assertEqual(
    getHydratedSupplementOther({ supplementOther: "" }),
    null,
    "Empty optional values should follow the existing null convention"
  );

  console.log("Supplement other hydration: 4 passed");
}

void main();
