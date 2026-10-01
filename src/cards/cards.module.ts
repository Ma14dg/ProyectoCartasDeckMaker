import { Module } from '@nestjs/common';
import { CardsService } from './cards.service.js';
import { CardsController } from './cards.controller.js';
import { ScryfallService } from './scryfall.service.js';

@Module({
  controllers: [CardsController],
  providers: [CardsService, ScryfallService],
})
export class CardsModule {}
