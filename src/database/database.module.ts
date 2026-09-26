import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import type { DB } from './types.js';

export const KYSELY = Symbol('KYSELY');

@Global()
@Module({
  providers: [
    {
      provide: KYSELY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Kysely<DB>({
          dialect: new MysqlDialect({
            pool: createPool({
              host: config.getOrThrow<string>('DB_HOST'),
              port: Number(config.getOrThrow<string>('DB_PORT')),
              database: config.getOrThrow<string>('DB_NAME'),
              user: config.getOrThrow<string>('DB_USER'),
              password: config.getOrThrow<string>('DB_PASSWORD'),
              connectionLimit: 10,
              timezone: 'Z',
            }),
          }),
        }),
    },
  ],
  exports: [KYSELY],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async onApplicationShutdown() {
    await this.db.destroy();
  }
}
