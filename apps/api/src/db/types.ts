import type { ColumnType, Generated } from 'kysely';
import type { ActivityVisibility, Sport, Units } from '@road-to/domain';

type Timestamp = ColumnType<Date, Date | string, Date | string>;

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

export type IntegrationStatus = 'active' | 'expired' | 'error' | 'revoked';

export type IntegrationTable = {
  id: string;
  user_id: string;
  provider: string;
  external_user_id: string;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: Date;
  scopes: string;
  status: Generated<IntegrationStatus>;
  last_sync_at: Date | null;
  last_error: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
};

export type ActivityTable = {
  id: string;
  user_id: string;
  sport: Sport;
  title: string;
  title_overridden: Generated<boolean>;
  started_at: Date;
  ended_at: Date;
  timezone: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_speed_mps: number | null;
  calories: number | null;
  map_polyline: string | null;
  visibility: Generated<ActivityVisibility>;
  description: string | null;
  field_sources: string;
  preferred_source_id: string | null;
  deleted_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
};

export type ActivitySourceTable = {
  id: string;
  activity_id: string;
  integration_id: string;
  provider: string;
  external_id: string;
  payload: string;
  fingerprint: string;
  has_gps: boolean;
  started_at: Date;
  distance_m: number | null;
  duration_s: number | null;
  sport_raw: string | null;
  provider_updated_at: Date | null;
  synced_at: Generated<Date>;
  deleted_on_provider_at: Date | null;
};

export type Database = {
  user: UserTable;
  session: SessionTable;
  account: AccountTable;
  verification: VerificationTable;
  integrations: IntegrationTable;
  activities: ActivityTable;
  activity_sources: ActivitySourceTable;
};
