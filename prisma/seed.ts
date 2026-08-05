import { PrismaClient, SystemRole, WorkspaceRole, ChannelVisibility } from '../libs/api/database/src/generated/index.js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database & infrastructure seed...');

  // 1. Seed Default Admin User
  const passwordHash = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@onetab.ai' },
    update: {},
    create: {
      email: 'admin@onetab.ai',
      name: 'System Admin',
      displayName: 'Admin',
      passwordHash,
      systemRole: SystemRole.SUPERADMIN,
      bio: 'OneTab AI Administrator',
    },
  });

  const devUser = await prisma.user.upsert({
    where: { email: 'dev@onetab.ai' },
    update: {},
    create: {
      email: 'dev@onetab.ai',
      name: 'Developer User',
      displayName: 'Dev',
      passwordHash,
      systemRole: SystemRole.USER,
      bio: 'OneTab AI Engineer',
    },
  });

  console.log(`👤 Users seeded: ${admin.email}, ${devUser.email}`);

  // 2. Seed Default Workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'onetab' },
    update: {},
    create: {
      name: 'OneTab AI',
      slug: 'onetab',
      description: 'Primary workspace for OneTab AI collaboration',
      ownerId: admin.id,
    },
  });

  console.log(`🏢 Workspace seeded: ${workspace.name} (${workspace.slug})`);

  // 3. Seed Workspace Memberships
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: admin.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: admin.id,
      role: WorkspaceRole.OWNER,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: devUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: devUser.id,
      role: WorkspaceRole.MEMBER,
    },
  });

  // 4. Seed Public Channels
  const channels = [
    { name: 'general', slug: 'general', topic: 'General discussion and announcements' },
    { name: 'random', slug: 'random', topic: 'Non-work banter and fun links' },
    { name: 'ai-lounge', slug: 'ai-lounge', topic: 'Local Ollama & AI experimentation' },
  ];

  for (const ch of channels) {
    const channel = await prisma.channel.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: ch.slug,
        },
      },
      update: {},
      create: {
        workspaceId: workspace.id,
        name: ch.name,
        slug: ch.slug,
        topic: ch.topic,
        visibility: ChannelVisibility.PUBLIC,
        createdById: admin.id,
      },
    });

    await prisma.channelMember.upsert({
      where: {
        channelId_userId: {
          channelId: channel.id,
          userId: admin.id,
        },
      },
      update: {},
      create: {
        channelId: channel.id,
        userId: admin.id,
      },
    });
  }

  console.log(`📢 Channels seeded: ${channels.map((c) => c.name).join(', ')}`);

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
