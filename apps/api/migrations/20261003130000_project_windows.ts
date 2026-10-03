import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('projects').addColumn('window_start', 'date').execute();
  await db.schema.alterTable('projects').addColumn('window_end', 'date').execute();
  await db.schema
    .alterTable('project_activities')
    .addColumn('excluded', 'boolean', (col) => col.notNull().defaultTo(false))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('project_activities').dropColumn('excluded').execute();
  await db.schema.alterTable('projects').dropColumn('window_end').execute();
  await db.schema.alterTable('projects').dropColumn('window_start').execute();
}
