import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/api-error';
import { buildOriginCheck } from './common/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Read at boot and asserted, not defaulted: an unset WEB_ORIGIN in
  // production would let the app render perfectly while every request from
  // the browser failed CORS, which reads as a broken product rather than a
  // missing environment variable.
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) {
    throw new Error('WEB_ORIGIN is not set. Set it to the web app origin(s), comma-separated.');
  }

  const cors = buildOriginCheck(webOrigin);
  if (cors.allowed.length === 0) {
    throw new Error(`WEB_ORIGIN is set but contains no usable origin: ${JSON.stringify(webOrigin)}`);
  }

  // Printed at boot so the deployed configuration is checkable from the logs.
  // A CORS mismatch is otherwise completely silent — the API answers 200, the
  // browser discards the response, and nothing anywhere says why.
  const log = new Logger('Cors');
  log.log(`Allowing origins: ${cors.allowed.join(', ')}`);
  if (cors.patterns.length > 0) {
    log.log(`Also allowing preview deployments: ${cors.patterns.map(String).join(', ')}`);
  }

  app.enableCors({
    origin(origin, callback) {
      // No Origin header at all — curl, server-to-server, health checks. CORS
      // is a browser policy; there is nothing to enforce here.
      if (!origin) return callback(null, true);

      if (cors.isAllowed(origin)) return callback(null, true);

      // Name the mismatch. This single line is the difference between "the
      // site is broken" and "WEB_ORIGIN has a typo", and it costs one log
      // entry per rejected request.
      log.warn(`Rejected origin ${JSON.stringify(origin)} — allowed: ${cors.allowed.join(', ')}`);
      return callback(null, false);
    },
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Slipstream API')
      .setDescription(
        'Decode, create and convert Betway Nigeria booking codes. Every endpoint works ' +
          'unauthenticated; a bearer token only attaches the action to an account history.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, doc);

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
