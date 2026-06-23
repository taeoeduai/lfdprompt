const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const oldApp = initializeApp({ credential: cert(require("./old-key.json")) }, "old");
const newApp = initializeApp({ credential: cert(require("./new-key.json")) }, "new");

const oldDb = getFirestore(oldApp);
const newDb = getFirestore(newApp);

async function copyCollection(name) {
  const snap = await oldDb.collection(name).get();
  console.log(`[${name}] 문서 ${snap.size}개 복사 시작`);
  let count = 0;
  for (const doc of snap.docs) {
    await newDb.collection(name).doc(doc.id).set(doc.data());
    count++;
  }
  console.log(`[${name}] ${count}개 완료`);
}

async function main() {
  const collections = ["library_overrides", "prompts", "registered_users", "reservations", "users"];
  for (const c of collections) {
    await copyCollection(c);
  }
  console.log("=== 전체 복사 완료 ===");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
