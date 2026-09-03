import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ErrorCode } from '@slipstream/shared';

function statusToCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 400:
    case 422:
      return 'VALIDATION_FAILED';
    default:
      return 'INTERNAL';
  }
}

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * Every error leaves the API in the same envelope — `{code, message, details}`
 * — because two clients (the web app and the Flutter app) branch on `code`.
 * An HTTP status alone cannot separate "Betway does not know that code" from
 * "we could not reach Betway", and those two need very different copy: one is
 * the user's typo, the other is nobody's fault and worth retrying.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();

    if (err instanceof AppError) {
      return res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
    }
    // P2025 is Prisma's "record required for this operation was not found".
    // Keep this narrow — every other Prisma error code must still fall
    // through to the 500 below rather than being flattened into a 404.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Not found' });
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      return res.status(status).json({ code: statusToCode(status), message: err.message });
    }
    this.logger.error(err);
    return res.status(500).json({ code: 'INTERNAL', message: 'Internal error' });
  }
}
