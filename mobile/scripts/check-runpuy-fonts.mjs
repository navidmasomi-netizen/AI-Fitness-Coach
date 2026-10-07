import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const assetsRoot = resolve(root, 'assets/fonts');
const aliases = [
  'RUNPUY-Manrope-400',
  'RUNPUY-Manrope-650',
  'RUNPUY-Manrope-700',
  'RUNPUY-Vazirmatn-400',
  'RUNPUY-Vazirmatn-650',
  'RUNPUY-Vazirmatn-700',
];

const requiredLicenses = [
  'licenses/Manrope-OFL.txt',
  'licenses/Manrope-FONTLOG.txt',
  'licenses/Vazirmatn-OFL.txt',
  'licenses/Vazirmatn-AUTHORS.txt',
];

const provenance = JSON.parse(readFileSync(resolve(assetsRoot, 'FONT-PROVENANCE.json'), 'utf8'));
const fontsModule = readFileSync(resolve(root, 'src/design-system/fonts.ts'), 'utf8');
const typographyModule = readFileSync(resolve(root, 'src/design-system/typography.ts'), 'utf8');

if (provenance.fontToolsVersion !== '4.66.1' || provenance.fonts.length !== aliases.length) {
  throw new Error('RUNPUY font provenance is incomplete.');
}

for (const alias of aliases) {
  const output = resolve(assetsRoot, `${alias}.ttf`);
  const entry = provenance.fonts.find((font) => font.alias === alias);

  if (!existsSync(output) || !entry) {
    throw new Error(`Missing RUNPUY font asset or provenance: ${alias}`);
  }

  if (!fontsModule.includes(alias)) {
    throw new Error(`Missing RUNPUY font registration alias: ${alias}`);
  }

  const checksum = createHash('sha256').update(readFileSync(output)).digest('hex');
  if (checksum !== entry.outputSha256) {
    throw new Error(`RUNPUY font checksum mismatch: ${alias}`);
  }
}

for (const license of requiredLicenses) {
  if (!existsSync(resolve(assetsRoot, license))) {
    throw new Error(`Missing RUNPUY font license material: ${license}`);
  }
}

for (const alias of ['heading: runpuyFontAliases.manrope650', 'title: runpuyFontAliases.manrope650', 'heading: runpuyFontAliases.vazirmatn650', 'title: runpuyFontAliases.vazirmatn650']) {
  if (!fontsModule.includes(alias)) {
    throw new Error(`Heading/title must map to the exact static 650 alias: ${alias}`);
  }
}

if (fontsModule.includes('manrope600') || fontsModule.includes('vazirmatn600') || typographyModule.includes('600')) {
  throw new Error('RUNPUY typography must not round 650 to 600.');
}

console.log('RUNPUY font assets, aliases, provenance, and typography mappings are valid.');
