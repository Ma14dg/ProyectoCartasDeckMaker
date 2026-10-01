import { Module } from '@nestjs/common';
import { DecksService } from './decks.service.js';
import { DecksController } from './decks.controller.js';

@Module({
  controllers: [DecksController],
  providers: [DecksService],
})
export class DecksModule {}
