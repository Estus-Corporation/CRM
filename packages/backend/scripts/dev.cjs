// Dev server com tsx watch em modo polling: no drive A: (Windows) os eventos de arquivo
// não chegavam e a API ficava desatualizada até reiniciar na mão.
const { spawn } = require('node:child_process');

const child = spawn(process.execPath, [require.resolve('tsx/cli'), 'watch', 'src/server.ts'], {
  stdio: 'inherit',
  env: { ...process.env, CHOKIDAR_USEPOLLING: 'true', CHOKIDAR_INTERVAL: '500' },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
