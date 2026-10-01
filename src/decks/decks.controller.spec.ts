import { Test, TestingModule } from '@nestjs/testing';
import { DecksController } from './decks.controller.js';
import { DecksService } from './decks.service.js';

describe('DecksController', () => {
  let controller: DecksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DecksController],
      providers: [DecksService],
    }).compile();

    controller = module.get<DecksController>(DecksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('exposes the deck controller', () => {
    expect(controller).toBeInstanceOf(DecksController);
  });
});
