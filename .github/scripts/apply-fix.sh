#!/usr/bin/env bash

set -euo pipefail

BUCKET="${1:?bucket required: safe | forceNonBreaking | breaking}"
AUDIT_SUMMARY="${AUDIT_SUMMARY:-audit-summary.json}"
export BUCKET AUDIT_SUMMARY

case "$BUCKET" in
  safe)
    BRANCH="auto-audit/fix-safe"
    TITLE="chore(security): in-range npm audit fixes"
    COMMIT_MSG="chore(security): apply in-range npm audit fixes"
    DESC="Applies \`npm audit fix\` for vulnerabilities whose fix is within the stated SemVer range."
    ;;
  forceNonBreaking)
    BRANCH="auto-audit/fix-force"
    TITLE="chore(security): non-breaking out-of-range upgrades"
    COMMIT_MSG="chore(security): upgrade out-of-range deps (non-breaking)"
    DESC="Upgrades dependencies whose fix is outside the stated SemVer range but is **not** SemVer-major."
    ;;
  breaking)
    BRANCH="auto-audit/fix-breaking"
    TITLE="chore(security)!: SemVer-major upgrades for vulnerabilities"
    COMMIT_MSG="chore(security)!: apply SemVer-major upgrades for vulnerabilities"
    DESC="**⚠️ Potentially breaking** - applies SemVer-major upgrades. Review each package's changelog before merging."
    ;;
  *) echo "unknown bucket: $BUCKET" >&2; exit 2 ;;
esac

PKG_PATHS=(package.json package-lock.json 'integration-tests/package.json' 'lambdas/*/package.json')

if [[ "$BUCKET" = "safe" ]]; then
  npm audit fix --ignore-scripts --workspaces --include-workspace-root || true
else
  node <<'JS'
const fs = require('fs');
const {execSync} = require('child_process');

const bucket = process.env.BUCKET;
const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const summary = JSON.parse(fs.readFileSync(process.env.AUDIT_SUMMARY, 'utf8'));
const targets = [...new Set((summary[bucket] || []).map(e => e.target).filter(Boolean))];

if (!targets.length) {
  console.log('No targets resolved for bucket ' + bucket + '; nothing to do.');
  process.exit(0);
}

// Expand workspace glob patterns to concrete directories
const wsDirs = (rootPkg.workspaces || []).flatMap(pattern => {
  try {
    return execSync('ls -d ' + pattern + ' 2>/dev/null', {encoding: 'utf8'})
      .trim().split('\n').filter(Boolean);
  } catch { return []; }
});

for (const target of targets) {
  // Handle scoped packages: @scope/name@version vs name@version
  const atIdx = target.lastIndexOf('@');
  const name = atIdx > 0 ? target.slice(0, atIdx) : target;

  let placed = false;
  for (const dir of wsDirs) {
    try {
      const wsPkg = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
      const deps = {...(wsPkg.dependencies || {}), ...(wsPkg.devDependencies || {})};
      if (name in deps) {
        console.log('Installing ' + target + ' in workspace ' + dir);
        execSync('npm install --ignore-scripts --save-exact ' + target + ' -w ' + dir, {stdio: 'inherit'});
        placed = true;
        break;
      }
    } catch {}
  }

  if (!placed) {
    const rootDeps = {...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {})};
    if (name in rootDeps) {
      console.log('Installing ' + target + ' in root');
      execSync('npm install --ignore-scripts --save-exact ' + target, {stdio: 'inherit'});
    } else {
      console.error('WARNING: ' + name + ' not a direct dep anywhere - skipping (transitive only).');
    }
  }
}
JS
fi

GITHUB_OUTPUT="${GITHUB_OUTPUT:-/dev/stdout}"

CHANGED_FILES=$(git diff --name-only -- "${PKG_PATHS[@]}")
if [[ -z "$CHANGED_FILES" ]]; then
  echo "No dependency changes produced for bucket $BUCKET; no PR needed."
  echo "changed=false" >> "$GITHUB_OUTPUT"
  exit 0
fi

echo "Changed files:"
echo "$CHANGED_FILES" | sed 's/^/  /'

BODY_PATH="${RUNNER_TEMP:-/tmp}/pr-body-${BUCKET}.md"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

{
  printf 'Automated PR from the `check-vulnerabilities` workflow.\n\n%s\n\n' "$DESC"
  node <<'JS'
const fs = require('fs');
const summary = JSON.parse(fs.readFileSync(process.env.AUDIT_SUMMARY, 'utf8'));
const entries = summary[process.env.BUCKET] || [];
console.log(entries.map(e => e.target
  ? '- `' + e.name + '` → `' + e.target + '` (' + e.severity + ')'
  : '- `' + e.name + '` (' + e.severity + ')'
).join('\n'));
JS
  printf '\n---\nRaised by run: %s\n' "$RUN_URL"
} > "$BODY_PATH"

{
  echo "changed=true"
  echo "branch=$BRANCH"
  echo "title=$TITLE"
  echo "commit_message=$COMMIT_MSG"
  echo "body_path=$BODY_PATH"
} >> "$GITHUB_OUTPUT"
