// Publica firestore.rules en Firebase con la cuenta de servicio del .env
// (lo mismo que pegarlas a mano en Firestore Database → Reglas → Publicar).
// Uso:  npm run reglas
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error('Faltan las variables de Firebase en el .env (ver README).');
  process.exit(1);
}
initializeApp({ credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') }) });

const fuente = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const r = await getSecurityRules().releaseFirestoreRulesetFromSource(fuente);
console.log(`Reglas publicadas en ${FIREBASE_PROJECT_ID} (${r.name}, ${r.createTime}).`);
