import { Global, Module } from '@nestjs/common';
import { BetwayClient } from './betway.client';

@Global()
@Module({ providers: [BetwayClient], exports: [BetwayClient] })
export class BetwayModule {}
