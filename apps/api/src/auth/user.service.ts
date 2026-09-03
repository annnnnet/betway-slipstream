import { Injectable } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * A local User row is created the first time someone signs in and exists
   * only to own their code history. Nothing in the product requires it — the
   * decode/encode/convert paths never touch this table — so the upsert is
   * kept as small as the feature it supports.
   */
  async upsertFromClaims(claims: JWTPayload) {
    const sub = String(claims.sub);
    // Lowercased on every write so the unique index cannot be defeated by a
    // provider that changes the casing of an address between sign-ins.
    const email = String(claims.email ?? `${sub}@unknown.local`).toLowerCase();
    const meta = (claims.user_metadata ?? {}) as Record<string, string>;

    // Atomic upsert rather than find-then-create: two tabs finishing sign-in
    // at once would otherwise race and one would hit a raw unique violation.
    return this.prisma.user.upsert({
      where: { supabaseSub: sub },
      create: { supabaseSub: sub, email, name: meta.full_name, avatarUrl: meta.avatar_url },
      update: { email, name: meta.full_name, avatarUrl: meta.avatar_url },
    });
  }
}
