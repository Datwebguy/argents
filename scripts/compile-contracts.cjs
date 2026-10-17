#!/usr/bin/env node
/**
 * Argents contract compiler
 *
 * Rebuilds contracts/artifacts with the exact solc version and optimizer
 * settings each contract was deployed with, so recompiling never silently
 * changes deployed bytecode.
 *
 *   node scripts/compile-contracts.cjs           write artifacts
 *   node scripts/compile-contracts.cjs --check   verify committed artifacts (no writes)
 *
 * The check ignores the trailing CBOR metadata hash, which does not affect execution.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Must match what is deployed on Arc Mainnet. Do not change for an existing contract.
const CONTRACTS = [
  { source: 'ArgentsAgent.sol', solc: '0.8.30', optimize: false },
  { source: 'ArgentsYield.sol', solc: '0.8.30', optimize: true },
  { source: 'ArgentsModes.sol', solc: '0.8.30', optimize: true },
  { source: 'ArgentsSignals.sol', solc: '0.8.30', optimize: true },
  { source: 'ArgentsAutopilotYield.sol', solc: '0.8.24', optimize: true },
];

const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = path.join(ROOT, 'contracts', 'artifacts');
const CHECK = process.argv.includes('--check');
const METADATA = /a264697066735822[0-9a-f]{68}64736f6c6343[0-9a-f]{6}0033/g;

const normalize = (file, text) => {
  const trimmed = text.trim();
  return file.endsWith('.bin') ? trimmed.replace(METADATA, '') : trimmed;
};

function compile({ source, solc, optimize }) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'argents-solc-'));
  const flags = optimize ? '--optimize --optimize-runs 200 ' : '';
  try {
    execSync(`npx --yes solc@${solc} --bin --abi ${flags}--base-path . -o "${out}" contracts/${source}`, {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
    });
  } catch {
    // solc has already printed the compiler error above.
    fs.rmSync(out, { recursive: true, force: true });
    console.error(`Failed to compile ${source} with solc ${solc}.`);
    process.exit(1);
  }
  // Imported files (e.g. ArgentsAgent.sol via ArgentsModes.sol) are emitted too;
  // keep only this source's own artifacts so each keeps its own settings.
  const prefix = `contracts_${source.replace('.sol', '_sol_')}`;
  const files = fs.readdirSync(out).filter((f) => f.startsWith(prefix));
  return { out, files };
}

let mismatches = 0;
for (const contract of CONTRACTS) {
  const label = `${contract.source} (solc ${contract.solc}${contract.optimize ? ', optimizer 200' : ''})`;
  const { out, files } = compile(contract);
  if (!files.length) throw new Error(`No artifacts produced for ${contract.source}`);

  let changed = 0;
  for (const file of files) {
    const built = fs.readFileSync(path.join(out, file), 'utf8');
    const target = path.join(ARTIFACTS, file);
    const committed = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    if (committed !== null && normalize(file, committed) === normalize(file, built)) continue;
    changed += 1;
    if (CHECK) {
      mismatches += 1;
      console.error(`MISMATCH ${file}`);
    } else {
      // Only rewrite on a real change, so an untouched source leaves git clean.
      fs.writeFileSync(target, built);
    }
  }
  fs.rmSync(out, { recursive: true, force: true });
  console.log(`${CHECK ? 'checked' : 'compiled'} ${label}: ${files.length} artifacts, ${changed} changed`);
}

if (CHECK && mismatches) {
  console.error(`${mismatches} artifact(s) differ from source. Run without --check to rebuild.`);
  process.exit(1);
}
