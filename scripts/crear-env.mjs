// Crea el archivo .env a partir del JSON de la cuenta de servicio de Firebase.
// Uso:  node scripts/crear-env.mjs "ruta\al\archivo-firebase-adminsdk.json"
// Si no pasás la ruta, busca el JSON en esta carpeta y en Descargas.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

function buscar() {
  const lugares = [process.cwd(), join(homedir(), 'Downloads'), join(homedir(), 'Descargas')];
  for (const dir of lugares) {
    if (!existsSync(dir)) continue;
    const f = readdirSync(dir).filter((n) => /firebase-adminsdk.*\.json$/i.test(n)).map((n) => join(dir, n));
    if (f.length) return f[0];
  }
  return null;
}

const ruta = process.argv[2] || buscar();
if (!ruta || !existsSync(ruta)) {
  console.error('No encontré el archivo de la clave. Pasá la ruta así:\n  node scripts/crear-env.mjs "C:\\Users\\vos\\Downloads\\el-sol-...-firebase-adminsdk-xxxx.json"');
  process.exit(1);
}

const sa = JSON.parse(readFileSync(ruta, 'utf8'));
if (!sa.private_key || !sa.client_email || !sa.project_id) {
  console.error('Ese archivo no parece una clave de cuenta de servicio de Firebase.');
  process.exit(1);
}

const n8n = existsSync('.env') ? (readFileSync('.env', 'utf8').match(/^N8N_WEBHOOK_URL=.*$/m)?.[0] || 'N8N_WEBHOOK_URL=') : 'N8N_WEBHOOK_URL=';
writeFileSync('.env', [
  `FIREBASE_PROJECT_ID=${sa.project_id}`,
  `FIREBASE_CLIENT_EMAIL=${sa.client_email}`,
  `FIREBASE_PRIVATE_KEY="${sa.private_key.replace(/\n/g, '\\n')}"`,
  n8n,
  '',
].join('\n'));

console.log(`✓ Archivo .env creado para el proyecto ${sa.project_id}`);
console.log('  Guardá el JSON en un lugar seguro fuera de esta carpeta y no lo compartas.');
