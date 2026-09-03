import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../common/api-error';
import { JwtVerifierService } from './jwt-verifier.service';
import { UserService } from './user.service';

export type Principal = { kind: 'user'; userId: string } | { kind: 'anonymous' };

/**
 * Resolves who is calling, and deliberately does *not* refuse anyone.
 *
 * Decoding, encoding and converting all work signed-out: a booking code is a
 * thing people paste to each other in group chats, and a login in front of
 * that would make the product worse at its main job. Signing in only adds a
 * durable history of the codes you have made.
 *
 * So a missing token yields an anonymous principal, while an *invalid* token
 * is still a hard 401 — silently downgrading a rejected session to anonymous
 * would show a signed-in-looking user an empty history and call it theirs.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private users: UserService,
    private jwt: JwtVerifierService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const bearer = req.headers.authorization?.replace(/^Bearer /, '');

    if (!bearer) {
      req.principal = { kind: 'anonymous' } satisfies Principal;
      return true;
    }

    let claims;
    try {
      claims = await this.jwt.verify(bearer);
    } catch {
      throw new AppError('UNAUTHORIZED', 'Your session has expired. Sign in again.', 401);
    }
    const user = await this.users.upsertFromClaims(claims);
    req.principal = { kind: 'user', userId: user.id } satisfies Principal;
    return true;
  }
}
