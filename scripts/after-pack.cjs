const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BUILDER_ARCH_NAMES = {
  0: 'ia32',
  1: 'x64',
  2: 'armv7l',
  3: 'arm64',
  4: 'universal',
};

function normalizeArch(arch) {
  if (typeof arch === 'string') return arch;
  return BUILDER_ARCH_NAMES[arch] || process.arch;
}

function assertWindowsBinding(bindingPath) {
  const signature = fs.readFileSync(bindingPath, { encoding: null, flag: 'r' }).subarray(0, 2).toString('ascii');
  if (signature !== 'MZ') {
    throw new Error(`Packaged sqlite3 binding is not a Windows DLL: ${bindingPath}`);
  }
}

module.exports = async function afterPack(context) {
  const targetPlatform = context.electronPlatformName;
  const targetArch = normalizeArch(context.arch);

  if (targetPlatform !== 'win32' || targetArch === 'universal') {
    return;
  }

  const sqliteDir = path.join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'sqlite3'
  );
  const bindingPath = path.join(sqliteDir, 'build', 'Release', 'node_sqlite3.node');

  if (!fs.existsSync(path.join(sqliteDir, 'package.json'))) {
    throw new Error(`Packaged sqlite3 module was not found: ${sqliteDir}`);
  }

  const prebuildInstallBin = require.resolve('prebuild-install/bin.js', {
    paths: [process.cwd()],
  });

  console.log(`[afterPack] Installing sqlite3 prebuild for ${targetPlatform}-${targetArch}`);
  const result = spawnSync(
    process.execPath,
    [
      prebuildInstallBin,
      '-r',
      'napi',
      '--platform',
      targetPlatform,
      '--arch',
      targetArch,
      '--force',
    ],
    {
      cwd: sqliteDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        npm_config_platform: targetPlatform,
        npm_config_arch: targetArch,
      },
    }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to install sqlite3 prebuild for ${targetPlatform}-${targetArch}`);
  }

  assertWindowsBinding(bindingPath);
  console.log(`[afterPack] sqlite3 binding ready: ${bindingPath}`);
};
