import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CardsService } from './cards.service.js';
import type { CreateCardDto } from './dto/create-card.dto.js';

const cardInput: CreateCardDto = {
  definition: {
    oracleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'Lightning Bolt',
    layout: 'normal',
    manaCost: '{R}',
    manaValue: 1,
    colors: ['Rojo'],
    colorIdentity: ['Rojo'],
    typeLine: 'Instant',
    oracleText: 'Lightning Bolt deals 3 damage to any target.',
    keywords: [],
    producedMana: [],
    legalities: { modern: 'legal' },
  },
  printing: {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    setCode: 'lea',
    setName: 'Limited Edition Alpha',
    collectorNumber: '161',
    language: 'en',
    rarity: 'Comun',
    finishes: ['nonfoil'],
  },
};

describe('CardsService', () => {
  let service: CardsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardsService],
    }).compile();

    service = module.get<CardsService>(CardsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates and finds a catalog entry by printing ID', () => {
    const createdEntry = service.create(cardInput);

    expect(createdEntry).toEqual(cardInput);
    expect(service.findAll()).toEqual([createdEntry]);
    expect(service.findOne(createdEntry.printing.id)).toBe(createdEntry);
  });

  it('requires a definition and printing', () => {
    expect(() => service.create({} as CreateCardDto)).toThrow(BadRequestException);
  });

  it('rejects duplicate printing IDs', () => {
    service.create(cardInput);

    expect(() => service.create(cardInput)).toThrow(ConflictException);
  });

  it('updates nested fields partially and preserves the printing ID', () => {
    service.create(cardInput);

    const updatedEntry = service.update(cardInput.printing.id, {
      definition: { oracleText: 'Updated Oracle text.' },
      printing: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        artist: 'Another Artist',
      },
    });

    expect(updatedEntry.definition.oracleText).toBe('Updated Oracle text.');
    expect(updatedEntry.definition.name).toBe(cardInput.definition.name);
    expect(updatedEntry.printing.id).toBe(cardInput.printing.id);
    expect(updatedEntry.printing.artist).toBe('Another Artist');
    expect(updatedEntry.printing.setCode).toBe(cardInput.printing.setCode);
  });

  it('removes an entry and reports missing IDs', () => {
    const createdEntry = service.create(cardInput);

    expect(service.remove(createdEntry.printing.id)).toBe(createdEntry);
    expect(service.findAll()).toEqual([]);
    expect(() => service.findOne(createdEntry.printing.id)).toThrow(NotFoundException);
    expect(() => service.remove(createdEntry.printing.id)).toThrow(NotFoundException);
  });
});