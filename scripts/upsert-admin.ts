import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { PrismaClient, SystemRole, WorkspaceRole } from '../libs/api/database/src/generated/client.js';

const BCRYPT_ROUNDS = 12;
const DEFAULT_EMAIL = 'admin@onetab.ai';
const DEFAULT_PASSWORD = 'Admin@OneTab2026!';
const DEFAULT_NAME = 'Platform Administrator';

interface CliArgs {
  email: string;
  password?: string;
  name: string;
  role: SystemRole;
  reset2fa: boolean;
  workspaceSlug?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const options: Partial<CliArgs> = {};

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run admin:upsert [-- [options]]
       npx tsx scripts/upsert-admin.ts [options]

Options:
  --email=<email>         Admin email address (default: admin@onetab.ai)
  --password=<pass>       Admin password (must meet complexity requirements)
  --name=<name>           Admin display name (default: Platform Administrator)
  --role=<role>           SUPERADMIN | SUPPORT | USER (default: SUPERADMIN)
  --no-reset-2fa          Keep existing 2FA configuration (default: resets 2FA)
  --workspace=<slug>      Workspace slug to link as ADMIN (default: primary workspace)
  --help, -h              Show this help message
`);
    process.exit(0);
  }

  for (const arg of args) {
    if (arg.startsWith('--email=')) {
      options.email = arg.split('=')[1].trim();
    } else if (arg.startsWith('--password=')) {
      options.password = arg.split('=')[1].trim();
    } else if (arg.startsWith('--name=')) {
      options.name = arg.split('=')[1].trim();
    } else if (arg.startsWith('--role=')) {
      const r = arg.split('=')[1].trim().toUpperCase();
      if (r === 'SUPERADMIN' || r === 'SUPPORT' || r === 'USER') {
        options.role = r as SystemRole;
      }
    } else if (arg === '--no-reset-2fa') {
      options.reset2fa = false;
    } else if (arg.startsWith('--workspace=')) {
      options.workspaceSlug = arg.split('=')[1].trim();
    }
  }

  return {
    email: (options.email || process.env['ADMIN_EMAIL'] || DEFAULT_EMAIL).toLowerCase(),
    password: options.password || process.env['ADMIN_PASSWORD'] || DEFAULT_PASSWORD,
    name: options.name || DEFAULT_NAME,
    role: options.role || SystemRole.SUPERADMIN,
    reset2fa: options.reset2fa ?? true,
    workspaceSlug: options.workspaceSlug,
  };
}

function validatePassword(password: string): void {
  if (password.length < 10) {
    throw new Error('Password must be at least 10 characters long.');
  }
  if (!/[a-z]/.test(password)) {
    throw new Error('Password must contain at least one lowercase letter.');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain at least one uppercase letter.');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain at least one number.');
  }
}

export async function upsertAdminUser(cliArgs?: Partial<CliArgs>) {
  const parsed = parseArgs();
  const args = { ...parsed, ...cliArgs };

  validatePassword(args.password!);

  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in the environment or .env file.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const passwordHash = await bcrypt.hash(args.password!, BCRYPT_ROUNDS);

    console.log(`\n======================================================`);
    console.log(` Provisioning Platform Admin User`);
    console.log(`======================================================`);
    console.log(` Target Email:   ${args.email}`);
    console.log(` System Role:    ${args.role}`);
    console.log(` Full Name:      ${args.name}`);
    console.log(` Reset 2FA:      ${args.reset2fa ? 'Yes' : 'No'}`);
    console.log(`------------------------------------------------------`);

    const existingUser = await prisma.user.findUnique({
      where: { email: args.email },
    });

    let user;
    let actionTaken: 'CREATED' | 'UPDATED';

    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: args.name,
          displayName: args.name,
          passwordHash,
          systemRole: args.role,
          emailVerifiedAt: existingUser.emailVerifiedAt ?? new Date(),
          updatedAt: new Date(),
        },
      });
      actionTaken = 'UPDATED';
    } else {
      user = await prisma.user.create({
        data: {
          email: args.email,
          name: args.name,
          displayName: args.name,
          passwordHash,
          systemRole: args.role,
          emailVerifiedAt: new Date(),
          presence: 'OFFLINE',
          timezone: 'UTC',
          preferredLanguage: 'en',
        },
      });
      actionTaken = 'CREATED';
    }

    // Reset 2FA if requested so user isn't blocked on login
    let twoFaStatus = 'Not configured';
    if (args.reset2fa) {
      await prisma.twoFactorChallenge.deleteMany({
        where: { userId: user.id },
      });
      const existing2fa = await prisma.twoFactorAuth.findUnique({
        where: { userId: user.id },
      });
      if (existing2fa) {
        await prisma.twoFactorAuth.delete({
          where: { userId: user.id },
        });
        twoFaStatus = 'Cleared (Disabled)';
      }
    }

    // Workspace association
    let workspaceMsg = 'None';
    const targetWorkspace = args.workspaceSlug
      ? await prisma.workspace.findUnique({ where: { slug: args.workspaceSlug } })
      : await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } });

    if (targetWorkspace) {
      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: targetWorkspace.id,
            userId: user.id,
          },
        },
      });

      if (!existingMember) {
        await prisma.workspaceMember.create({
          data: {
            workspaceId: targetWorkspace.id,
            userId: user.id,
            role: WorkspaceRole.ADMIN,
            status: 'ACTIVE',
          },
        });
        workspaceMsg = `Linked to "${targetWorkspace.name}" (${targetWorkspace.slug}) as ADMIN`;
      } else {
        workspaceMsg = `Already member of "${targetWorkspace.name}" (${targetWorkspace.slug}) [${existingMember.role}]`;
      }
    }

    console.log(`\n Result:`);
    console.log(` - Action:          ${actionTaken}`);
    console.log(` - User ID:         ${user.id}`);
    console.log(` - Email:           ${user.email}`);
    console.log(` - System Role:     ${user.systemRole}`);
    console.log(` - Email Verified:  ${user.emailVerifiedAt ? 'Yes' : 'No'}`);
    console.log(` - 2FA:             ${twoFaStatus}`);
    console.log(` - Workspace:       ${workspaceMsg}`);
    console.log(` - Password:        ${args.password}`);
    console.log(`------------------------------------------------------`);
    console.log(` Admin Portal URL:  http://localhost:4201`);
    console.log(` Web App URL:       http://localhost:4200`);
    console.log(`======================================================\n`);

    return {
      success: true,
      action: actionTaken,
      user,
      password: args.password,
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('upsert-admin.ts') || process.argv[1]?.endsWith('upsert-admin.js')) {
  upsertAdminUser().catch((err) => {
    console.error('\n❌ Failed to provision admin user:', err.message);
    process.exit(1);
  });
}
