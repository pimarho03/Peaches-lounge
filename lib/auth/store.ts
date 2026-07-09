import "server-only";

import bcrypt from "bcryptjs";

export type Role = "client" | "staff" | "admin";

export type PasskeyCredential = {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports?: string[];
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  /** Base32 TOTP secret. Always set for staff/admin; opt-in for clients. */
  totpSecret: string | null;
  passkeys: PasskeyCredential[];
  /** Device ids this user has previously logged in from. */
  knownDevices: Set<string>;
};

export type Session = {
  token: string;
  userId: string;
  role: Role;
  createdAt: number;
  expiresAt: number;
  deviceId: string;
};

/** A login that passed the password step but still owes a second factor. */
export type PendingMfa = {
  token: string;
  userId: string;
  remember: boolean;
  deviceId: string;
  expiresAt: number;
  attempts: number;
};

export type OneTimeToken = {
  token: string;
  userId: string;
  purpose: "magic-link" | "otp" | "reset";
  /** Only set for OTP: the 6-digit code the token guards. */
  code?: string;
  expiresAt: number;
  attempts: number;
};

type AuthDb = {
  users: Map<string, User>; // keyed by normalized email
  sessions: Map<string, Session>;
  pendingMfa: Map<string, PendingMfa>;
  oneTimeTokens: Map<string, OneTimeToken>;
  passkeyChallenges: Map<string, { challenge: string; expiresAt: number }>;
  /** Failed-login timestamps per `${email}|${ip}` for rate limiting. */
  failedAttempts: Map<string, number[]>;
  lockouts: Map<string, number>; // key → unlock timestamp
};

/**
 * Demo TOTP secrets are fixed so the flow can be exercised without an email
 * or SMS provider. In production every secret is generated per user at
 * enrollment and stored encrypted at rest.
 */
export const DEMO_USERS: Array<{
  email: string;
  name: string;
  role: Role;
  password: string;
  totpSecret: string | null;
}> = [
  {
    email: "client@peacheslounge.com",
    name: "Petra Client",
    role: "client",
    password: "matcha-and-mats",
    totpSecret: null,
  },
  {
    email: "staff@peacheslounge.com",
    name: "Sam Staff",
    role: "staff",
    password: "reformer-rows-9",
    totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  },
  {
    email: "admin@peacheslounge.com",
    name: "Ada Admin",
    role: "admin",
    password: "deep-black-11111",
    totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
  },
];

function seed(): AuthDb {
  const users = new Map<string, User>();
  for (const [i, u] of DEMO_USERS.entries()) {
    users.set(u.email, {
      id: `user_${i + 1}`,
      email: u.email,
      name: u.name,
      role: u.role,
      passwordHash: bcrypt.hashSync(u.password, 10),
      totpSecret: u.totpSecret,
      passkeys: [],
      knownDevices: new Set(),
    });
  }
  return {
    users,
    sessions: new Map(),
    pendingMfa: new Map(),
    oneTimeTokens: new Map(),
    passkeyChallenges: new Map(),
    failedAttempts: new Map(),
    lockouts: new Map(),
  };
}

/**
 * In-memory store, stashed on globalThis so it survives dev-server HMR.
 * Swap for a real database (Postgres/Prisma) before launch — the shape of
 * the maps mirrors the tables you'd create.
 */
const globalForAuth = globalThis as unknown as { __peachesAuthDb?: AuthDb };

export function db(): AuthDb {
  globalForAuth.__peachesAuthDb ??= seed();
  return globalForAuth.__peachesAuthDb;
}

export function findUserByEmail(email: string): User | undefined {
  return db().users.get(email);
}

export function findUserById(id: string): User | undefined {
  for (const u of db().users.values()) if (u.id === id) return u;
  return undefined;
}

/**
 * Self-serve registration. Only ever creates `client` accounts — staff and
 * admin are provisioned by an admin, never self-signup, so the role can't be
 * escalated from the public form. `email` must already be normalized.
 */
export function createUser(input: {
  email: string;
  name: string;
  password: string;
}): User {
  const user: User = {
    id: `user_${randomId()}`,
    email: input.email,
    name: input.name,
    role: "client",
    passwordHash: bcrypt.hashSync(input.password, 10),
    totpSecret: null,
    passkeys: [],
    knownDevices: new Set(),
  };
  db().users.set(user.email, user);
  return user;
}

/** Replace a user's password hash (reset flow). */
export function setPassword(user: User, password: string): void {
  user.passwordHash = bcrypt.hashSync(password, 10);
}

let idCounter = 0;
/** Monotonic id source — avoids Math.random (unavailable in some contexts). */
function randomId(): string {
  idCounter += 1;
  return `${db().users.size + 1}_${idCounter}`;
}
