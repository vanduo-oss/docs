#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const failures = [];
const releaseVersion = '1.4.1';

const scanEntries = [
  'README.md',
  'llms.txt',
  'index.html',
  'package.json',
  'css',
  'sections',
  'templates',
  'js/app.js',
  'js/section-cache.js',
  'js/components/vd-hex.js',
  'sw.js',
  'tests/e2e/docs-view.spec.ts'
];

const historicalFiles = new Set([
  'sections/changelog.html',
  'tests/e2e/docs-view.spec.ts'
]);

const tokenAliasAllowedFiles = new Set([
  'sections/changelog.html'
]);

const requiredGuideIds = [
  'runtime-architecture',
  'lifecycle-manager',
  'security-practices',
  'production-best-practices'
];

function toRel(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function walk(entry) {
  const absolute = path.join(rootDir, entry);
  if (!fs.existsSync(absolute)) {
    failures.push(entry + ': expected path is missing');
    return [];
  }

  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    return fs.readdirSync(absolute).flatMap((child) => walk(path.join(entry, child)));
  }

  if (!/\.(html|css|js|json|md|txt|ts)$/.test(absolute)) {
    return [];
  }

  return [absolute];
}

function lineFor(content, index) {
  return content.slice(0, index).split('\n').length;
}

function addPatternFailure(relPath, content, pattern, message) {
  let match;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(content)) !== null) {
    failures.push(relPath + ':' + lineFor(content, match.index) + ': ' + message + ' (' + match[0] + ')');
  }
}

function readJson(relPath) {
  const absolute = path.join(rootDir, relPath);
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    failures.push(relPath + ': invalid JSON: ' + error.message);
    return null;
  }
}

const files = scanEntries.flatMap(walk);

for (const file of files) {
  const relPath = toRel(file);
  const content = fs.readFileSync(file, 'utf8');

  if (!historicalFiles.has(relPath)) {
    addPatternFailure(
      relPath,
      content,
      /(?:@v1\.3\.9|framework@v?1\.3\.9|\bv1\.3\.9\b)/g,
      'stale v1.3.9 reference in active docs'
    );

    addPatternFailure(
      relPath,
      content,
      /(?:1\.4\.0-docs|v140-docs\d|vanduo-sections-v140)/g,
      'stale v1.4.0 docs cache key in active runtime'
    );
  }

  addPatternFailure(
    relPath,
    content,
    /Vanduo\.(?:reinit|getComponent)\(\s*(['"])LazyLoad\1/g,
    'legacy LazyLoad registry name used in runtime API example'
  );

  addPatternFailure(
    relPath,
    content,
    /Vanduo\.components\.LazyLoad|Vanduo\.register\(\s*(['"])LazyLoad\1/g,
    'legacy LazyLoad registry key used instead of lazyLoad'
  );

  if (relPath === 'README.md' || relPath === 'llms.txt' || relPath.startsWith('sections/')) {
    addPatternFailure(
      relPath,
      content,
      /Vanduo\.components\.[A-Za-z0-9_$]+/g,
      'direct component registry access used in docs; prefer Vanduo.getComponent(canonicalName)'
    );

    addPatternFailure(
      relPath,
      content,
      /class="code-example"/g,
      'legacy code-example block used; prefer the unified .vd-code-snippet component'
    );
  }

  if (!tokenAliasAllowedFiles.has(relPath)) {
    addPatternFailure(
      relPath,
      content,
      /--(?!vd-)(?:color|bg|text|shadow|border)-[a-z0-9-]+/g,
      'unprefixed semantic token used outside migration/history docs'
    );

    addPatternFailure(
      relPath,
      content,
      /(?:var\(\s*|<code>|<span class="code-property">|['"])--(?:code|tab|sidenav|tc|space|transition)-[a-z0-9-]+/g,
      'legacy component/framework token used outside migration/history docs'
    );
  }

  addPatternFailure(
    relPath,
    content,
    /--vd-[a-z0-9-]+-(?=[);])/g,
    'possibly truncated --vd-* token'
  );

  addPatternFailure(
    relPath,
    content,
    /--vd-radius-(?:sm|md)\b/g,
    'legacy radius token used in active docs; use --vd-radius-fib-* or a radius utility'
  );

  if (relPath.startsWith('sections/guides/')) {
    addPatternFailure(
      relPath,
      content,
      /themeCustomizer:\s*(?:change|open|close|reset)|themeCustomizer:\s/g,
      'legacy theme customizer event name used in guide; use theme:* events'
    );

    addPatternFailure(
      relPath,
      content,
      /\.set(?:Primary|Neutral|Radius|Font|Theme)\b/g,
      'legacy theme customizer method used in guide; use apply*() or setPreferences()'
    );
  }
}

const packageJson = readJson('package.json');
if (packageJson && packageJson.version !== releaseVersion) {
  failures.push('package.json: expected version ' + releaseVersion + ', found ' + packageJson.version);
}
if (packageJson && (!packageJson.scripts || packageJson.scripts['audit:v141'] !== 'node scripts/audit-v140-docs.js')) {
  failures.push('package.json: missing audit:v141 script');
}

const buildInfo = readJson('dist/build-info.json');
if (buildInfo && buildInfo.version !== releaseVersion) {
  failures.push('dist/build-info.json: expected version ' + releaseVersion + ', found ' + buildInfo.version);
}

const docsViewTestPath = path.join(rootDir, 'tests/e2e/docs-view.spec.ts');
if (fs.existsSync(docsViewTestPath)) {
  const docsViewTest = fs.readFileSync(docsViewTestPath, 'utf8');
  if (!docsViewTest.includes("Shows v" + releaseVersion + " as latest")) {
    failures.push('tests/e2e/docs-view.spec.ts: changelog test should assert v' + releaseVersion + ' as latest');
  }
  if (!docsViewTest.includes("toContainText('v" + releaseVersion + "')")) {
    failures.push('tests/e2e/docs-view.spec.ts: missing v' + releaseVersion + ' latest-card assertion');
  }
}

const sections = readJson('sections/sections.json');
if (sections && sections.tabs && sections.tabs.guides) {
  const registeredGuideIds = new Set();
  for (const category of sections.tabs.guides.categories || []) {
    for (const section of category.sections || []) {
      registeredGuideIds.add(section.id);
    }
  }

  for (const id of requiredGuideIds) {
    if (!registeredGuideIds.has(id)) {
      failures.push('sections/sections.json: missing v' + releaseVersion + ' guide registration for ' + id);
    }
  }
}

for (const id of requiredGuideIds) {
  const expectedFile = path.join(rootDir, 'sections/guides/' + id + '.html');
  if (!fs.existsSync(expectedFile)) {
    failures.push('sections/guides/' + id + '.html: required v' + releaseVersion + ' guide file is missing');
  }
}

if (failures.length > 0) {
  console.error('[audit:v141] Found ' + failures.length + ' release drift issue(s):');
  for (const failure of failures) {
    console.error('  - ' + failure);
  }
  process.exit(1);
}

console.log('[audit:v141] Docs release drift audit passed.');
