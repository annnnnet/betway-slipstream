#!/usr/bin/env node
/**
 * Validates the GitHub Actions workflows before they are pushed.
 *
 * Written after breaking one: a step-level `if: ${{ secrets.X != '' }}` is not
 * valid — the `secrets` context is not available there — and the failure mode
 * is unusually unhelpful. GitHub cannot parse the file at all, so the run is
 * named after the *filename* rather than the workflow, no job ever starts, and
 * there is no annotation explaining why. Catching it locally costs a second;
 * catching it on GitHub costs a push, a run and a confused minute.
 *
 * Usage: node scripts/check-workflows.js
 */
const fs = require('node:fs');
const path = require('node:path');

// js-yaml arrives as a transitive dependency of the toolchain rather than a
// direct one — resolving it by walking the pnpm store keeps this script from
// adding a dependency purely to lint two files.
function loadYamlParser() {
  const root = path.resolve(__dirname, '..', 'node_modules', '.pnpm');
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root)) {
    if (!entry.startsWith('js-yaml@')) continue;
    const candidate = path.join(root, entry, 'node_modules', 'js-yaml');
    if (fs.existsSync(candidate)) return require(candidate);
  }
  return null;
}

const yaml = loadYamlParser();
if (!yaml) {
  console.log('SKIP  js-yaml not installed; run `pnpm install` first.');
  process.exit(0);
}

const WORKFLOWS = path.resolve(__dirname, '..', '.github', 'workflows');
let ok = true;

for (const file of fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))) {
  const full = path.join(WORKFLOWS, file);
  let doc;
  try {
    doc = yaml.load(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    ok = false;
    console.log(`FAIL  ${file}: ${err.message.split('\n')[0]}`);
    continue;
  }

  const problems = [];

  // A workflow with no `name` is legal but shows up in the UI as its path,
  // which is also what a validation failure looks like — avoid the ambiguity.
  if (!doc.name) problems.push('no top-level `name`');

  for (const [jobName, job] of Object.entries(doc.jobs ?? {})) {
    for (const step of job.steps ?? []) {
      const label = step.name ?? step.uses ?? '(unnamed)';
      if (step.if && /secrets\./.test(String(step.if))) {
        problems.push(`job "${jobName}" step "${label}": \`secrets\` context is not allowed in \`if:\` — lift it to job-level \`env\``);
      }
      // Same trap, one level subtler: a step's own `env:` is not reliably
      // readable by that step's own `if:`.
      if (step.if && step.env) {
        for (const key of Object.keys(step.env)) {
          if (new RegExp(`env\\.${key}\\b`).test(String(step.if))) {
            problems.push(`job "${jobName}" step "${label}": \`if:\` reads env.${key} defined on the same step — move it to job-level \`env\``);
          }
        }
      }
    }
  }

  if (problems.length) {
    ok = false;
    console.log(`FAIL  ${file}`);
    for (const p of problems) console.log(`        ${p}`);
  } else {
    console.log(`OK    ${file}  jobs: ${Object.keys(doc.jobs ?? {}).join(', ')}`);
  }
}

process.exit(ok ? 0 : 1);
