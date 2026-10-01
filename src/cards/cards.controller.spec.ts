import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';
import { ScryfallService } from './scryfall.service.js';

describe('CardsController', () => {
  let controller: CardsController;
  const scryfallService = { search: vi.fn().mockResolvedValue({ data: [] }) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardsController],
      providers: [CardsService, { provide: ScryfallService, useValue: scryfallService }],
    }).compile();

    controller = module.get<CardsController>(CardsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('builds a Scryfall query from common search filters', async () => {
    await controller.search({ name: 'Lightning Bolt', color: 'R', type: 'Instant', page: '2' });

    expect(scryfallService.search).toHaveBeenCalledWith(
      'name:"Lightning Bolt" type:"Instant" color:R',
      2,
    );
  });

  it('rejects malformed search filters', () => {
    expect(() => controller.search({ color: 'Purple' })).toThrow(BadRequestException);
    expect(() => controller.search({ page: '0' })).toThrow(BadRequestException);
  });
});
