import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Postgres is a *supporting* store here, not the source of truth: it holds the
 * slip cache and the action log. Betway holds the actual state.
 *
 * So a database that will not connect degrades the product rather than
 * stopping it — decoding, building and converting all still work, only the
 * cache and the signed-in history go quiet. Refusing to boot would take the
 * whole app down to protect two features nobody needs in order to get a
 * booking code. Every call site already treats persistence as best-effort.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly log = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      this.log.error(
        `Database unavailable — running without the slip cache or history. ${(err as Error).message}`,
      );
    }
  }
}
