import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../../libs/api/database/src/generated/client.js';
import { readMatrixConfig } from '../../libs/api/matrix/src/lib/matrix.config.js';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const cfg = readMatrixConfig(process.env);
async function req(path: string, token?: string, init: any = {}) {
  const r = await fetch(cfg.homeserverUrl + path, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function main() {
  let token = cfg.adminToken;
  if (!token) token = (await req('/_matrix/client/v3/login', undefined, { method: 'POST', body: JSON.stringify({ type: 'm.login.password', identifier: { type: 'm.id.user', user: cfg.adminUsername }, password: cfg.adminPassword }) })).body.access_token;
  const email = process.argv[2] ?? 'amara.iverson@onetab.test';
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, matrixUserId: true } });
  console.log(u);
  const cms = await prisma.channelMember.findMany({ where: { userId: u!.id }, select: { channel: { select: { slug: true, matrixRoomId: true, workspace: { select: { slug: true } } } } } });
  for (const cm of cms) {
    const room = cm.channel.matrixRoomId;
    if (!room) { console.log(cm.channel.slug, 'no room'); continue; }
    const st = await req(`/_synapse/admin/v1/rooms/${encodeURIComponent(room)}/state`, token);
    const ev = (st.body.state ?? []).find((e: any) => e.type === 'm.room.member' && e.state_key === u!.matrixUserId);
    console.log(cm.channel.workspace.slug, cm.channel.slug, room, ev?.content?.membership ?? 'none', st.status);
  }
  await prisma.$disconnect();
}
main();
