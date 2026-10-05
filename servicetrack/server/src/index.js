import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config.js';
if (!config.secret || config.secret.length < 32)
  throw new Error('Run npm run setup first to create a session secret.');
try {
  await mongoose.connect(config.mongo, { serverSelectionTimeoutMS: 5000 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName)
    throw new Error(
      'MongoDB must run as a replica set for inventory transactions. Use npm run db.',
    );
  const server = app.listen(config.port, '127.0.0.1', () =>
    console.log(`ServiceTrack API: http://localhost:${config.port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () =>
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      }),
    );
} catch (error) {
  console.error('Cannot start ServiceTrack:', error.message);
  process.exit(1);
}
