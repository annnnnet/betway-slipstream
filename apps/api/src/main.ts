import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/api-error';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // Read at boot and asserted, not defaulted: an unset WEB_ORIGIN in
  // production would let the app render perfectly while every request from
  // the browser failed CORS, which reads as a broken product rather than a
  // missing environment variable.
  const origins = process.env.WEB_ORIGIN;
  if (!origins) {
    throw new Error('WEB_ORIGIN is not set. Set it to the web app origin(s), comma-separated.');
  }
  app.enableCors({
    origin: origins.split(',').map((o) => o.trim()),
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
