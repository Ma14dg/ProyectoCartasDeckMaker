import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DecksService } from './decks.service.js';
import type { CardCatalogEntry } from '../cards/entities/card-catalog.entity.js';

function makeCard(options: {
  name: string;
  printingId: string;
  oracleId: string;
  typeLine?: string;
  colors?: CardCatalogEntry['definition']['colors'];
  colorIdentity?: CardCatalogEntry['definition']['colorIdentity'];
  legalities?: Record<string, string>;
}): CardCatalogEntry {
  return {
    definition: {
      oracleId: options.oracleId,
      name: options.name,
      manaValue: 1,
      colors: options.colors ?? [],
      colorIdentity: options.colorIdentity ?? [],
      typeLine: options.typeLine ?? 'Instant',
      keywords: [],
      producedMana: [],
      legalities: options.legalities ?? { standard: 'legal', commander: 'legal' },
    },
    printing: {
      id: options.printingId,
      setCode: 'tst',
      setName: 'Test Set',
      collectorNumber: '1',
      language: 'en',
      rarity: 'Comun',
      finishes: ['nonfoil'],
    },
  };
}

const plains = makeCard({
  name: 'Plains',
  printingId: '11111111-1111-4111-8111-111111111111',
  oracleId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  typeLine: 'Basic Land — Plains',
  legalities: { standard: 'legal', commander: 'legal' },
});

const commanderCard = makeCard({
  name: 'Example Captain',
  printingId: '22222222-2222-4222-8222-222222222222',
  oracleId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  typeLine: 'Legendary Creature — Human Soldier',
  colors: ['Blanco'],
  colorIdentity: ['Blanco'],
});

const redCard = makeCard({
  name: 'Red Spell',
  printingId: '33333333-3333-4333-8333-333333333333',
  oracleId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  colors: ['Rojo'],
  colorIdentity: ['Rojo'],
});

describe('DecksService', () => {
  let service: DecksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DecksService],
    }).compile();
    service = module.get<DecksService>(DecksService);
  });

  it('creates, lists, updates, finds and removes decks', () => {
    const deck = service.create({ name: '  White Standard  ', format: 'standard' });
    expect(deck.name).toBe('White Standard');
    expect(service.findAll()).toHaveLength(1);
    expect(service.update(deck.id, { description: 'Primer mazo' }).description).toBe('Primer mazo');
    expect(service.findOne(deck.id).description).toBe('Primer mazo');
    expect(service.remove(deck.id).id).toBe(deck.id);
    expect(() => service.findOne(deck.id)).toThrow(NotFoundException);
  });

  it('adds cards by printing ID and validates Standard size and legality', () => {
    const deck = service.create({ name: 'Standard', format: 'standard' });
    const updated = service.addCard(deck.id, { card: plains, quantity: 60 });

    expect(updated.cards[0].printingId).toBe(plains.printing.id);
    expect(updated.cards[0].card.definition.name).toBe('Plains');
    expect(service.validate(deck.id)).toMatchObject({
      valid: true,
      cardCount: 60,
      expectedCardCount: '60 o mas',
    });
  });

  it('rejects more than four copies of a Standard nonbasic card', () => {
    const deck = service.create({ name: 'Standard', format: 'standard' });

    expect(() => service.addCard(deck.id, { card: commanderCard, quantity: 5 })).toThrow(
      BadRequestException,
    );
  });

  it('counts Standard copies by Oracle ID across different printings', () => {
    const deck = service.create({ name: 'Standard', format: 'standard' });
    const reprint = {
      ...commanderCard,
      printing: { ...commanderCard.printing, id: '44444444-4444-4444-8444-444444444444' },
    };
    service.addCard(deck.id, { card: commanderCard, quantity: 3 });

    expect(() => service.addCard(deck.id, { card: reprint, quantity: 2 })).toThrow(
      BadRequestException,
    );
  });

  it('requires a single eligible commander and enforces color identity', () => {
    const deck = service.create({ name: 'Commander', format: 'commander' });
    service.addCard(deck.id, { card: commanderCard, zone: 'commander' });

    expect(() => service.addCard(deck.id, { card: redCard })).toThrow(BadRequestException);
    expect(() => service.addCard(deck.id, { card: plains, zone: 'commander' })).toThrow(
      BadRequestException,
    );
    expect(service.validate(deck.id)).toMatchObject({
      valid: false,
      cardCount: 1,
      commander: { printingId: commanderCard.printing.id },
    });
  });

  it('counts commander decks to exactly 100 including commander', () => {
    const deck = service.create({ name: 'Commander', format: 'commander' });
    service.addCard(deck.id, { card: commanderCard, zone: 'commander' });
    service.addCard(deck.id, { card: plains, quantity: 99 });

    expect(service.validate(deck.id)).toMatchObject({ valid: true, cardCount: 100 });
  });

  it('updates and removes cards by printing ID', () => {
    const deck = service.create({ name: 'Standard', format: 'standard' });
    service.addCard(deck.id, { card: plains, quantity: 2 });

    expect(service.updateCard(deck.id, plains.printing.id, { quantity: 3 }).cards[0].quantity).toBe(3);
    expect(service.removeCard(deck.id, plains.printing.id).cards).toEqual([]);
    expect(() => service.removeCard(deck.id, plains.printing.id)).toThrow(NotFoundException);
  });

  it('returns counts, color distribution, card types and mana curve', () => {
    const deck = service.create({ name: 'Standard', format: 'standard' });
    const creature = makeCard({
      name: 'White Knight',
      printingId: '55555555-5555-4555-8555-555555555555',
      oracleId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      typeLine: 'Creature — Knight',
      colors: ['Blanco'],
      colorIdentity: ['Blanco'],
    });
    creature.definition.manaValue = 2;
    service.addCard(deck.id, { card: creature, quantity: 3 });
    service.addCard(deck.id, { card: plains, quantity: 2 });

    expect(service.statistics(deck.id)).toMatchObject({
      totalCards: 5,
      mainboardCount: 5,
      colors: { Blanco: 3 },
      cardTypes: { Creature: 3 },
      manaCurve: { '0': 0, '2': 3 },
    });
  });

  it('exports and imports a versioned deck backup with printing snapshots', () => {
    const originalDeck = service.create({ name: 'Export Test', format: 'commander' });
    service.addCard(originalDeck.id, { card: commanderCard, zone: 'commander' });
    service.addCard(originalDeck.id, { card: plains, quantity: 99 });

    const backup = service.export(originalDeck.id);
    const importedDeck = service.import(backup);

    expect(backup.schemaVersion).toBe(1);
    expect(importedDeck.id).not.toBe(originalDeck.id);
    expect(importedDeck.name).toBe(originalDeck.name);
    expect(importedDeck.format).toBe(originalDeck.format);
    expect(importedDeck.cards).toEqual(service.findOne(originalDeck.id).cards);
    expect(service.validate(importedDeck.id).valid).toBe(true);
  });

  it('rejects invalid backups without leaving a partial deck', () => {
    const originalDeck = service.create({ name: 'Valid Deck', format: 'standard' });
    service.addCard(originalDeck.id, { card: plains, quantity: 2 });
    const backup = service.export(originalDeck.id);
    const invalidBackup = {
      ...backup,
      deck: {
        ...backup.deck,
        cards: [{ ...backup.deck.cards[0], printingId: 'different-id' }],
      },
    };

    expect(() => service.import(invalidBackup)).toThrow(BadRequestException);
    expect(service.findAll()).toHaveLength(1);
  });
});