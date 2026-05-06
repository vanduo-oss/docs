#!/usr/bin/env node

const { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } = require('fs');
const path = require('path');

const docsRoot = path.resolve(__dirname, '..');
const docsDistDir = path.join(docsRoot, 'dist');
const configuredFrameworkRoot = process.env.VANDUO_FRAMEWORK_DIR
  ? path.resolve(process.env.VANDUO_FRAMEWORK_DIR)
  : null;

function resolveFrameworkRoot() {
  if (configuredFrameworkRoot) {
    return configuredFrameworkRoot;
  }

  const candidateRoots = [
    path.resolve(docsRoot, '../framework'),
    path.resolve(docsRoot, '../vanduo-framework')
  ];

  return candidateRoots.find((candidateRoot) => existsSync(path.join(candidateRoot, 'dist'))) || candidateRoots[0];
}

const frameworkRoot = resolveFrameworkRoot();
const frameworkDistDir = path.join(frameworkRoot, 'dist');

function readBuildInfo(distDir) {
  const buildInfoPath = path.join(distDir, 'build-info.json');

  if (!existsSync(buildInfoPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(buildInfoPath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function logBuildInfo(prefix, buildInfo) {
  if (!buildInfo) {
    console.log(prefix + ': build-info.json not available');
    return;
  }

  console.log(
    prefix + ': v' + buildInfo.version + ' (' + buildInfo.commit + ', ' + buildInfo.mode + ')'
  );
}

function hasVendoredDocsAssets() {
  return existsSync(path.join(docsDistDir, 'vanduo.min.css'))
    && existsSync(path.join(docsDistDir, 'vanduo.min.js'));
}

function syncFrameworkAssets() {
  mkdirSync(docsDistDir, { recursive: true });

  if (!existsSync(frameworkDistDir)) {
    if (hasVendoredDocsAssets()) {
      console.warn(
        '[sync-framework-assets] Framework dist not found at ' + frameworkDistDir + '. Using vendored docs dist.'
      );
      logBuildInfo('[sync-framework-assets] Vendored docs dist', readBuildInfo(docsDistDir));
      return;
    }

    throw new Error(
      'Framework dist not found at ' + frameworkDistDir + ' and vendored docs assets are unavailable.'
    );
  }

  // Overlay framework artifacts so docs-specific files under dist/ remain intact.
  const frameworkEntries = readdirSync(frameworkDistDir);
  frameworkEntries.forEach((entry) => {
    const sourcePath = path.join(frameworkDistDir, entry);
    const targetPath = path.join(docsDistDir, entry);
    cpSync(sourcePath, targetPath, { recursive: true, force: true });
  });

  // Sync framework JS component and util files needed by docs demos.
  const frameworkJsDir = path.join(frameworkRoot, 'js');
  const docsJsDir = path.join(docsRoot, 'js');

  const jsSubdirs = ['components', 'utils'];
  jsSubdirs.forEach((subdir) => {
    const src = path.join(frameworkJsDir, subdir);
    const dst = path.join(docsJsDir, subdir);
    if (existsSync(src)) {
      mkdirSync(dst, { recursive: true });
      const entries = readdirSync(src);
      entries.forEach((entry) => {
        if (entry.endsWith('.js')) {
          cpSync(path.join(src, entry), path.join(dst, entry), { force: true });
        }
      });
      console.log('[sync-framework-assets] Synced ' + entries.filter(e => e.endsWith('.js')).length + ' files from framework/js/' + subdir + '/ → docs/js/' + subdir + '/');
    }
  });

  console.log(
    '[sync-framework-assets] Synced ' + frameworkEntries.length + ' framework entries into ' + docsDistDir + '.'
  );
  logBuildInfo('[sync-framework-assets] Framework dist', readBuildInfo(frameworkDistDir));
  logBuildInfo('[sync-framework-assets] Docs dist', readBuildInfo(docsDistDir));
}

try {
  syncFrameworkAssets();
} catch (error) {
  console.error('[sync-framework-assets] ' + error.message);
  process.exit(1);
}
