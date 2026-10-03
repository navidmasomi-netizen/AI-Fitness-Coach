import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDirectory, '..');
const brandRoot = path.resolve(mobileRoot, '../brand-system/assets/brand');
const destinationRoot = path.resolve(mobileRoot, 'assets/brand');
const isCheckMode = process.argv.includes('--check');

const copiedAssets = [
  ['02-app-icons/ios/runpuy-app-icon-ios.png', 'app-icon.png'],
  ['02-app-icons/web/favicon-32.png', 'favicon.png'],
  ['01-logo/png/runpuy-primary-horizontal.png', 'logo-horizontal.png'],
  ['01-logo/png/runpuy-primary-horizontal-reverse.png', 'logo-horizontal-reverse.png'],
  ['01-logo/png/runpuy-symbol-emerald.png', 'symbol-emerald.png'],
];

const rasterizedAssets = [
  ['02-app-icons/android/ic_launcher_foreground.svg', 'adaptive-icon-foreground.png', 512],
  ['02-app-icons/android/ic_launcher_monochrome.svg', 'adaptive-icon-monochrome.png', 432],
];

function assertPngDimensions(buffer, expectedSize, file) {
  const pngSignature = '89504e470d0a1a0a';

  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error(`RUNPUY_ASSETS_SYNC: ${file} is not a PNG.`);
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);

  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(
      `RUNPUY_ASSETS_SYNC: ${file} must be ${expectedSize}x${expectedSize}, received ${width}x${height}.`,
    );
  }
}

function rasterizeSvg(svg, size, source) {
  const png = Buffer.from(new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  }).render().asPng());

  assertPngDimensions(png, size, source);
  return png;
}

async function assertMatches(expected, destination) {
  let actual;

  try {
    actual = await readFile(destination);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`RUNPUY_ASSETS_SYNC: missing ${destination}. Run the sync script.`);
    }

    throw error;
  }

  if (!expected.equals(actual)) {
    throw new Error(`RUNPUY_ASSETS_SYNC: stale ${destination}. Run the sync script.`);
  }
}

async function main() {
  if (!isCheckMode) {
    await mkdir(destinationRoot, { recursive: true });
  }

  for (const [sourceRelativePath, destinationName] of copiedAssets) {
    const source = path.join(brandRoot, sourceRelativePath);
    const destination = path.join(destinationRoot, destinationName);

    if (isCheckMode) {
      await assertMatches(await readFile(source), destination);
    } else {
      await copyFile(source, destination);
    }
  }

  for (const [sourceRelativePath, destinationName, size] of rasterizedAssets) {
    const source = path.join(brandRoot, sourceRelativePath);
    const destination = path.join(destinationRoot, destinationName);
    const expectedPng = rasterizeSvg(await readFile(source), size, source);

    if (isCheckMode) {
      await assertMatches(expectedPng, destination);
    } else {
      await writeFile(destination, expectedPng);
    }
  }

  console.log(`RUNPUY_ASSETS_SYNC: ${isCheckMode ? 'PASS' : 'generated'}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
