import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {createInterface} from 'node:readline';
import {Writable} from 'node:stream';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const db = new PrismaClient();
const quietOutput = new Writable({write(_chunk, _encoding, callback) {callback();}});
const prompt = createInterface({input: process.stdin, output: quietOutput, terminal: Boolean(process.stdin.isTTY)});

function ask(label) {
  process.stdout.write(label);
  return new Promise((resolve) => prompt.question('', resolve));
}

try {
  const email = (await ask('Administrator email: ')).trim().toLowerCase();
  const password = await ask('Password (at least 14 characters; input hidden): ');
  const confirmation = await ask('Confirm password (input hidden): ');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid administrator email.');
  if (password.length < 14) throw new Error('Use a password with at least 14 characters.');
  if (password !== confirmation) throw new Error('Passwords do not match.');

  const existing = await db.adminUser.findUnique({where: {email}});
  if (existing) throw new Error('An administrator already exists for that email. No account was changed.');

  await db.adminUser.create({data: {email, passwordHash: await bcrypt.hash(password, 12)}});
  console.log(`Administrator account created for ${email}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to create the administrator account.');
  process.exitCode = 1;
} finally {
  prompt.close();
  await db.$disconnect();
}
