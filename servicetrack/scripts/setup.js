import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!fs.existsSync('.env')) {
  fs.writeFileSync(
    '.env',
    fs
      .readFileSync('.env.example', 'utf8')
      .replace('replace-with-at-least-32-random-characters', randomBytes(48).toString('hex')),
  );
  console.log('Created .env with a random session secret.');
} else console.log('Existing .env preserved.');
