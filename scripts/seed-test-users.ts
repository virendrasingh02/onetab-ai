/**
 * Seeds throwaway teammates into a workspace, for testing chat with more than
 * one person.
 *
 * Registering through the API would only get half of it: `POST /auth/register`
 * creates an account and nothing else, and every step after that — workspace
 * membership, channel membership — needs the owner's session. So this writes
 * the rows directly and then mirrors them onto the homeserver.
 *
 * The Matrix half is not optional. Nothing in the web client ever calls
 * `joinRoom`, so a user who is a channel member in our database but not a
 * member of the backing room opens the channel to an empty timeline and cannot
 * post. The bridge invites (as the room's creator, who holds PL100) and joins
 * (as the user, through an admin puppet token) on their behalf.
 *
 * Usage:
 *   npx tsx scripts/seed-test-users.ts
 *   npx tsx scripts/seed-test-users.ts --workspace=acme-inc --count=3
 *   npx tsx scripts/seed-test-users.ts --password='Sup3rSecret!' --no-matrix
 */
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { PrismaClient } from '../libs/api/database/src/generated/client.js';
import {
  deriveUserPassword,
  readMatrixConfig,
  toMatrixLocalpart,
  toMatrixUserId,
  usesAdminCredentials,
  type MatrixConfig,
} from '../libs/api/matrix/src/lib/matrix.config.js';

/** Matches the API's cost factor, so a seeded login is as slow as a real one. */
const BCRYPT_ROUNDS = 12;

/** Satisfies `passwordSchema`: 10+ chars with an upper, a lower and a digit. */
const DEFAULT_PASSWORD = 'Test@12345';

const DEFAULT_WORKSPACE_SLUG = 'onetab-ai';

/** Seeded accounts all share this domain, which is what marks them as test data. */
const TEST_EMAIL_DOMAIN = '@onetab.test';

const MAX_RATE_LIMIT_RETRIES = 10;
/**
 * Longer than the API's own cap: a seed run can afford to wait out `rc_joins`,
 * which refills at roughly one join every ten seconds.
 */
const MAX_RATE_LIMIT_WAIT_MS = 60_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const FIRST_NAMES = [
  'Ava',
  'Noah',
  'Mira',
  'Kai',
  'Ines',
  'Omar',
  'Lena',
  'Rhys',
  'Nina',
  'Tobias',
  'Sana',
  'Marco',
  'Priya',
  'Ellis',
  'Yuki',
  'Dara',
  'Felix',
  'Rosa',
  'Jonas',
  'Amara',
];

const LAST_NAMES = [
  'Stone',
  'Varga',
  'Okafor',
  'Lindqvist',
  'Rahman',
  'Delgado',
  'Beaumont',
  'Nakamura',
  'Iverson',
  'Costa',
  'Halloran',
  'Ferreira',
  'Novak',
  'Bright',
  'Mensah',
  'Kovac',
  'Silva',
  'Ashford',
];

/** Spread across zones, so `LocalTime` has something to show. */
const TIMEZONES = [
  'Asia/Kolkata',
  'Europe/Berlin',
  'America/New_York',
  'Europe/London',
  'Australia/Sydney',
  'America/Los_Angeles',
  'Asia/Tokyo',
];

interface Options {
  workspaceSlug: string;
  count: number;
  password: string;
  matrix: boolean;
}

function parseArgs(argv: string[]): Options {
  const flag = (name: string): string | undefined => {
    const match = argv.find((arg) => arg.startsWith(`--${name}=`));
    return match?.slice(name.length + 3);
  };

  const count = Number(flag('count') ?? 5);
  if (!Number.isInteger(count) || count < 1 || count > 25) {
    throw new Error('--count must be a whole number between 1 and 25.');
  }

  return {
    workspaceSlug: flag('workspace') ?? DEFAULT_WORKSPACE_SLUG,
    count,
    password: flag('password') ?? DEFAULT_PASSWORD,
    matrix: !argv.includes('--no-matrix'),
  };
}

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] as T;
}

/** A name pair that has not been used yet in this run. */
function randomPerson(taken: Set<string>): { name: string; email: string } {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const email = `${first}.${last}@onetab.test`.toLowerCase();
    if (!taken.has(email)) {
      taken.add(email);
      return { name: `${first} ${last}`, email };
    }
  }
  throw new Error('Ran out of unused name combinations.');
}

// --- Synapse ---------------------------------------------------------------

/**
 * The slice of the Synapse admin API this script needs.
 *
 * A trimmed copy of `MatrixAdminService` rather than an import of it: that one
 * is a Nest provider wired to `ConfigService`, and standing up an application
 * context to seed five users is more machinery than the job deserves.
 */
class Synapse {
  private token: string | undefined;
  private readonly creators = new Map<string, string>();
  private readonly roomMembers = new Map<string, Set<string>>();

  constructor(private readonly config: MatrixConfig) {
    this.token = config.adminToken;
  }

  /**
   * One call, waiting out `M_LIMIT_EXCEEDED`.
   *
   * Synapse rate-limits invites and joins per room and per sender, and seeding
   * several people into several rooms hits that within seconds. The homeserver
   * says how long to wait, so honour it rather than giving up — the alternative
   * is a half-seeded workspace.
   */
  private async request<T>(
    path: string,
    init: { method?: string; accessToken?: string; body?: unknown } = {},
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(`${this.config.homeserverUrl}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(init.accessToken
            ? { Authorization: `Bearer ${init.accessToken}` }
            : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });

      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};

      if (response.ok) return payload as T;

      const retryAfter = Number(payload.retry_after_ms ?? 0);
      if (
        response.status === 429 &&
        attempt < MAX_RATE_LIMIT_RETRIES &&
        retryAfter <= MAX_RATE_LIMIT_WAIT_MS
      ) {
        await sleep(Math.max(retryAfter, 500));
        continue;
      }

      const error = new Error(
        `${init.method ?? 'GET'} ${path} -> ${response.status} ` +
          `${payload.errcode ?? ''} ${payload.error ?? text}`.trim(),
      );
      Object.assign(error, {
        errcode: payload.errcode,
        status: response.status,
      });
      throw error;
    }
  }

  /** The admin session, signing in with the password if no token is set. */
  private async adminToken(): Promise<string> {
    if (this.token) return this.token;

    const login = await this.request<{ access_token: string }>(
      '/_matrix/client/v3/login',
      {
        method: 'POST',
        body: {
          type: 'm.login.password',
          identifier: { type: 'm.id.user', user: this.config.adminUsername },
          password: this.config.adminPassword,
        },
      },
    );

    this.token = login.access_token;
    return this.token;
  }

  /** A device-less token that acts as another user. */
  private async actAs(matrixUserId: string): Promise<string> {
    const response = await this.request<{ access_token: string }>(
      `/_synapse/admin/v1/users/${encodeURIComponent(matrixUserId)}/login`,
      {
        method: 'POST',
        accessToken: await this.adminToken(),
        body: { valid_until_ms: Date.now() + 300_000 },
      },
    );
    return response.access_token;
  }

  /** Creates (or updates) the Matrix account backing one of our users. */
  async provisionUser(userId: string, displayName: string): Promise<string> {
    const matrixUserId = toMatrixUserId(
      toMatrixLocalpart(userId),
      this.config.serverName,
    );

    await this.request(
      `/_synapse/admin/v2/users/${encodeURIComponent(matrixUserId)}`,
      {
        method: 'PUT',
        accessToken: await this.adminToken(),
        body: {
          // The same derivation the bridge uses, so the account behaves like
          // one it provisioned itself if encryption is ever switched on.
          password: deriveUserPassword(
            this.config.userPasswordSecret,
            matrixUserId,
          ),
          displayname: displayName,
          admin: false,
          deactivated: false,
          logout_devices: false,
        },
      },
    );

    return matrixUserId;
  }

  /** A token belonging to the room's creator, who can invite into it. */
  private async creatorToken(roomId: string): Promise<string> {
    let creator = this.creators.get(roomId);

    if (!creator) {
      const room = await this.request<{ creator?: string }>(
        `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}`,
        { accessToken: await this.adminToken() },
      );
      if (!room.creator) {
        throw new Error(`Room ${roomId} has no known creator to act as.`);
      }
      creator = room.creator;
      this.creators.set(roomId, creator);
    }

    return this.actAs(creator);
  }

  /** Who is already in a room, read once and then tracked locally. */
  private async members(roomId: string): Promise<Set<string>> {
    let members = this.roomMembers.get(roomId);
    if (members) return members;

    const response = await this.request<{ members: string[] }>(
      `/_synapse/admin/v1/rooms/${encodeURIComponent(roomId)}/members`,
      { accessToken: await this.adminToken() },
    );

    members = new Set(response.members);
    this.roomMembers.set(roomId, members);
    return members;
  }

  /**
   * Puts a bridged user in a room: invited by the creator, then joined as
   * themselves.
   *
   * Membership is checked first, and not only to save two calls. Synapse's
   * `rc_invites.per_user` bucket refills at one invite every few minutes, and
   * it is charged for an invite to someone already in the room — so a repair
   * run that re-invited everyone would rate-limit itself out of doing the one
   * thing it was run for.
   */
  async ensureRoomMember(roomId: string, matrixUserId: string): Promise<void> {
    const members = await this.members(roomId);
    if (members.has(matrixUserId)) return;

    try {
      await this.request(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`,
        {
          method: 'POST',
          accessToken: await this.creatorToken(roomId),
          body: { user_id: matrixUserId },
        },
      );
    } catch (error) {
      // A pending invite from an earlier run: the join below settles it.
      if (!isAlreadyInvited(error)) throw error;
    }

    await this.request(
      `/_matrix/client/v3/join/${encodeURIComponent(roomId)}`,
      {
        method: 'POST',
        accessToken: await this.actAs(matrixUserId),
        body: {},
      },
    );

    members.add(matrixUserId);
  }
}

function isAlreadyInvited(error: unknown): boolean {
  return (error as { errcode?: string }).errcode === 'M_FORBIDDEN';
}

// --- seeding ---------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: options.workspaceSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!workspace) {
      const known = await prisma.workspace.findMany({ select: { slug: true } });
      throw new Error(
        `No workspace with slug "${options.workspaceSlug}". ` +
          `Known slugs: ${known.map((w) => w.slug).join(', ')}`,
      );
    }

    const channels = await prisma.channel.findMany({
      where: { workspaceId: workspace.id, isArchived: false },
      select: { id: true, name: true, slug: true, matrixRoomId: true },
      orderBy: { createdAt: 'asc' },
    });

    const matrixConfig = readMatrixConfig(process.env);
    const useMatrix =
      options.matrix &&
      matrixConfig.enabled &&
      usesAdminCredentials(matrixConfig);

    if (options.matrix && !useMatrix) {
      console.warn(
        'Matrix is disabled or has no admin credentials — seeding accounts ' +
          'only. They will not be able to open chat until the bridge is ' +
          'configured.',
      );
    }

    const synapse = useMatrix ? new Synapse(matrixConfig) : null;

    /**
     * Brings one seeded account up to date: workspace member, member of every
     * live channel, and a member of each backing Matrix room.
     *
     * Written as an "ensure" rather than a "create" so an interrupted run —
     * Synapse rate-limits invites, and a large seed will meet that limit — is
     * repaired by running the script again.
     */
    const ensureSeeded = async (user: {
      id: string;
      name: string;
      email: string;
      timezone: string;
      matrixUserId: string | null;
    }): Promise<string> => {
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
        },
        update: {},
        create: { workspaceId: workspace.id, userId: user.id, role: 'MEMBER' },
      });

      for (const channel of channels) {
        await prisma.channelMember.upsert({
          where: {
            channelId_userId: { channelId: channel.id, userId: user.id },
          },
          update: {},
          create: { channelId: channel.id, userId: user.id, role: 'MEMBER' },
        });
      }

      if (!synapse) return '(no matrix identity)';

      const matrixUserId = await synapse.provisionUser(user.id, user.name);
      if (user.matrixUserId !== matrixUserId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { matrixUserId },
        });
      }

      for (const channel of channels) {
        if (!channel.matrixRoomId) {
          console.warn(
            `  ! #${channel.slug} has no Matrix room yet — open it once as the ` +
              'owner, then re-run to join everyone.',
          );
          continue;
        }
        await synapse.ensureRoomMember(channel.matrixRoomId, matrixUserId);
      }

      return matrixUserId;
    };

    const report = (
      user: { name: string; email: string; timezone: string },
      matrixUserId: string,
    ): void => {
      console.log(
        `  ${user.name.padEnd(20)} ${user.email.padEnd(30)} ` +
          `${user.timezone.padEnd(20)} ${matrixUserId}`,
      );
    };

    // Existing test accounts first: a previous run may have stopped partway
    // through, leaving someone without a room to talk in.
    const existing = await prisma.user.findMany({
      where: {
        email: { endsWith: TEST_EMAIL_DOMAIN },
        // Scoped to this workspace: seeding a second workspace should not drag
        // every test account ever created into it.
        workspaceMembers: { some: { workspaceId: workspace.id } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        matrixUserId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (existing.length > 0) {
      console.log(`Reconciling ${existing.length} existing test account(s)\n`);
      for (const user of existing) report(user, await ensureSeeded(user));
      console.log('');
    }

    console.log(
      `Seeding ${options.count} new user(s) into "${workspace.name}" ` +
        `(${channels.length} channel(s))\n`,
    );

    const passwordHash = await bcrypt.hash(options.password, BCRYPT_ROUNDS);
    const taken = new Set(existing.map((user) => user.email));

    for (let index = 0; index < options.count; index += 1) {
      const { name, email } = randomPerson(taken);

      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          timezone: pick(TIMEZONES),
          emailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          timezone: true,
          matrixUserId: true,
        },
      });

      report(user, await ensureSeeded(user));
    }

    console.log(`\nPassword for the new accounts: ${options.password}`);
    console.log(`Members of: ${channels.map((c) => `#${c.slug}`).join(', ')}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`\nSeeding failed: ${String(error)}`);
  process.exitCode = 1;
});
