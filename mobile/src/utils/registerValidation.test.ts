function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const { validateEmail, validateName, validatePassword } = (await (0, eval)(
    'import("./registerValidation.ts")'
  )) as typeof import("./registerValidation");

  assertEqual(validateName("Ada Lovelace"), null, "A valid name should pass");
  assertEqual(validateName("  Ada Lovelace  "), null, "A padded valid name should pass");
  assertEqual(validateName(""), "Full name is required.", "An empty name should fail");
  assertEqual(validateName("   \t\n"), "Full name is required.", "A whitespace-only name should fail");
  assertEqual(validateEmail("athlete@example.com"), null, "A valid email should pass");
  assertEqual(validatePassword("password"), null, "A provided password should pass");

  console.log("Register client validation: 6 passed");
}

void main();
