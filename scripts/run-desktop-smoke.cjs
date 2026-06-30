const { spawn } = require('child_process');
const path = require('path');

const electronBinary = require('electron');

const projectRoot = process.cwd();

function streamChildOutput(child) {
  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });
}

async function main() {
  const child = spawn(electronBinary, ['.'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      BLADEVAULT_FORCE_PROD_SERVER: '1',
      BLADEVAULT_SMOKE_TEST: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  streamChildOutput(child);

  const timeout = setTimeout(() => {
    child.kill();
  }, 90000);

  child.once('exit', (code) => {
    clearTimeout(timeout);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
