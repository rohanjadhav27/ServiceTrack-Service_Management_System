// Runs a real single-member MongoDB replica set with persistent local files.
// The first run downloads MongoDB; subsequent runs reuse the cached binary.
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import fs from 'node:fs';
import path from 'node:path';
const dbPath = path.resolve(process.env.MONGODB_DATA_DIR || '.data/mongodb');
fs.mkdirSync(dbPath, { recursive: true });
const db = await MongoMemoryReplSet.create({
  instanceOpts: [
    { port: 27017, dbPath, args: process.platform === 'win32' ? [] : ['--nounixsocket'] },
  ],
  replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
});
if (db.servers[0].instanceInfo.port !== 27017) {
  await db.stop({ doCleanup: false });
  throw new Error('Port 27017 is busy. Stop the other local database before running npm run db.');
}
console.log(`MongoDB ready at 127.0.0.1:27017. Keep this terminal open. Data: ${dbPath}`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await db.stop({ doCleanup: false });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
