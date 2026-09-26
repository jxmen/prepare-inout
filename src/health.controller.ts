import { Controller, Get, Inject } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { KYSELY } from './database/database.module.js';
import type { DB } from './database/types.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  @Get()
  async check() {
    const { rows } = await sql<{ version: string }>`select version() as version`.execute(this.db);
    return { status: 'ok', mysql: rows[0].version };
  }

  test() {

  }
}
