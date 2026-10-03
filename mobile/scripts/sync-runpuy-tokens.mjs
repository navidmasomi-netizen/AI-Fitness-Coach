import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDirectory, '..');
const canonicalSource = path.resolve(
  mobileRoot,
  '../brand-system/assets/brand/06-tokens/runpuy-brand-tokens.json',
);
const generatedFile = path.resolve(
  mobileRoot,
  'src/design-system/generated/runpuy-tokens.ts',
);
const isCheckMode = process.argv.includes('--check');

function serializeTokens(tokens) {
  return [
    '/*',
    ' * GENERATED FILE — DO NOT EDIT MANUALLY.',
    ' * Canonical source: brand-system/assets/brand/06-tokens/runpuy-brand-tokens.json',
    ' */',
    '',
    `export const runpuyTokens = ${JSON.stringify(tokens, null, 2)} as const;`,
    '',
  ].join('\n');
}

async function main() {
  const canonicalJson = await readFile(canonicalSource, 'utf8');
  const expectedOutput = serializeTokens(JSON.parse(canonicalJson));

  if (isCheckMode) {
    let currentOutput;

    try {
      currentOutput = await readFile(generatedFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error('RUNPUY_TOKENS_SYNC: generated file is missing. Run the sync script.');
        process.exitCode = 1;
        return;
      }

      throw error;
    }

    if (currentOutput !== expectedOutput) {
      console.error('RUNPUY_TOKENS_SYNC: generated file is stale. Run the sync script.');
      process.exitCode = 1;
      return;
    }

    console.log('RUNPUY_TOKENS_SYNC: PASS');
    return;
  }

  await writeFile(generatedFile, expectedOutput, 'utf8');
  console.log('RUNPUY_TOKENS_SYNC: generated');
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
