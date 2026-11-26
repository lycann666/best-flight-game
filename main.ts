// main.ts — hands the entry in: copies game/ and screenshots/ to /output
// (or $MAKEFUN_OUTPUT_DIR outside the grader) and writes /output/dossier.json
// with buildDossier from ./vendor/makefun-game.ts. Node 22, standard library only.
// Deterministic: two runs over the same repository write byte-identical output.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// Only clear the CONTENTS of the output dir — never remove the dir itself.
// (In the grader the dir is pre-created and its parent is read-only, so
// removing it would fail with EACCES.)
mkdirSync(out, { recursive: true });
for (const child of readdirSync(out)) rmSync(join(out, child), { recursive: true, force: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`wrote ${out}/dossier.json`);
