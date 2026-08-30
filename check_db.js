import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, collectionGroup } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const q = collectionGroup(db, 'grades');
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("No grades found");
  } else {
    snap.forEach(doc => {
      console.log("--- Doc:", doc.ref.path);
      const data = doc.data();
      fs.writeFileSync('grades_dump.json', JSON.stringify(data, null, 2));
      console.log("Saved to grades_dump.json");
    });
  }
  process.exit(0);
}
run();
