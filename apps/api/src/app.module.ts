import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BetwayModule } from './betway/betway.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { PrismaModule } from './prisma/prisma.module';
import { SlipsModule } from './slips/slips.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BetwayModule,
    SlipsModule,
    CatalogueModule,
  ],
})
export class AppModule {}
