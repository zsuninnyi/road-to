import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Units = 'metric' | 'imperial';

export type UserTable = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  units: Generated<Units>;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};

export type SessionTable = {
  id: string;
  expiresAt: Timestamp;
  token: string;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string;
};

export type AccountTable = {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Timestamp | null;
  refreshTokenExpiresAt: Timestamp | null;
  scope: string | null;
  password: string | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};

export type VerificationTable = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Timestamp;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
};

export type ActivityTable = {
  id: string;
  user_id: string;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};

export type Database = {
  user: UserTable;
  session: SessionTable;
  account: AccountTable;
  verification: VerificationTable;
  activities: ActivityTable;
};
