import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CardsModule } from './cards/cards.module.js';
import { DecksModule } from './decks/decks.module.js';

@Module({
  imports: [CardsModule, DecksModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
