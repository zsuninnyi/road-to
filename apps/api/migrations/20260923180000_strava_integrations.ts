import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('activities').ifExists().execute();

  await db.schema
    .createTable('integrations')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('external_user_id', 'text', (col) => col.notNull())
    .addColumn('access_token_enc', 'text', (col) => col.notNull())
    .addColumn('refresh_token_enc', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('scopes', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
    .addColumn('last_sync_at', 'timestamptz')
    .addColumn('last_error', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('integrations_user_provider_uidx')
    .on('integrations')
    .columns(['user_id', 'provider'])
    .unique()
    .execute();

  await db.schema
    .createTable('activities')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('sport', 'text', (col) => col.notNull())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('title_overridden', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('started_at', 'timestamptz', (col) => col.notNull())
    .addColumn('ended_at', 'timestamptz', (col) => col.notNull())
    .addColumn('timezone', 'text')
    .addColumn('distance_m', 'float8')
    .addColumn('moving_time_s', 'integer')
    .addColumn('elapsed_time_s', 'integer')
    .addColumn('elevation_gain_m', 'float8')
    .addColumn('avg_hr', 'integer')
    .addColumn('max_hr', 'integer')
    .addColumn('avg_speed_mps', 'float8')
    .addColumn('calories', 'float8')
    .addColumn('map_polyline', 'text')
    .addColumn('visibility', 'text', (col) => col.notNull().defaultTo('private'))
    .addColumn('description', 'text')
    .addColumn('field_sources', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('preferred_source_id', 'text')
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex('activities_user_started_idx')
    .on('activities')
    .columns(['user_id', 'started_at'])
    .execute();

  await db.schema
    .createTable('activity_sources')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('activity_id', 'text', (col) =>
      col.notNull().references('activities.id').onDelete('cascade'),
    )
    .addColumn('integration_id', 'text', (col) =>
      col.notNull().references('integrations.id').onDelete('cascade'),
    )
    .addColumn('provider', 'text', (col) => col.notNull())
    .addColumn('external_id', 'text', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull())
    .addColumn('fingerprint', 'text', (col) => col.notNull())
    .addColumn('has_gps', 'boolean', (col) => col.notNull())
    .addColumn('started_at', 'timestamptz', (col) => col.notNull())
    .addColumn('distance_m', 'float8')
    .addColumn('duration_s', 'integer')
    .addColumn('sport_raw', 'text')
    .addColumn('provider_updated_at', 'timestamptz')
    .addColumn('synced_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_on_provider_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('activity_sources_provider_external_uidx')
    .on('activity_sources')
    .columns(['provider', 'external_id'])
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('activity_sources').ifExists().execute();
  await db.schema.dropTable('activities').ifExists().execute();
  await db.schema.dropTable('integrations').ifExists().execute();

  await db.schema
    .createTable('activities')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('user_id', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}
