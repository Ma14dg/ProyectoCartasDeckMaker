import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CardCatalogEntry } from '../cards/entities/card-catalog.entity.js';
import type { AddDeckCardDto } from './dto/add-deck-card.dto.js';
import type { CreateDeckDto } from './dto/create-deck.dto.js';
import type { ImportDeckDto } from './dto/import-deck.dto.js';
import type { UpdateDeckCardDto } from './dto/update-deck-card.dto.js';
import type { UpdateDeckDto } from './dto/update-deck.dto.js';
import type {
  Deck,
  DeckCard,
  DeckCardZone,
  DeckExportFile,
  DeckFormat,
  DeckStatistics,
  DeckValidation,
} from './entities/deck.entity.js';

const COLOR_ORDER = ['Blanco', 'Azul', 'Negro', 'Rojo', 'Verde'];
const VALID_FORMATS = ['standard', 'commander'];
const VALID_ZONES = ['mainboard', 'sideboard', 'commander'];

function isDeckFormat(value: unknown): value is DeckFormat {
  return typeof value === 'string' && VALID_FORMATS.includes(value);
}

function isDeckCardZone(value: unknown): value is DeckCardZone {
  return typeof value === 'string' && VALID_ZONES.includes(value);
}

function isCatalogEntry(value: unknown): value is CardCatalogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<CardCatalogEntry>;
  return Boolean(
    entry.definition &&
      typeof entry.definition.name === 'string' &&
      typeof entry.definition.manaValue === 'number' &&
      Number.isFinite(entry.definition.manaValue) &&
      typeof entry.definition.typeLine === 'string' &&
      Array.isArray(entry.definition.colors) &&
      Array.isArray(entry.definition.colorIdentity) &&
      Array.isArray(entry.definition.keywords) &&
      Array.isArray(entry.definition.producedMana) &&
      typeof entry.definition.legalities === 'object' &&
      entry.definition.legalities !== null &&
      entry.printing &&
      typeof entry.printing.id === 'string' &&
      entry.printing.id.length > 0 &&
      typeof entry.printing.setCode === 'string' &&
      typeof entry.printing.setName === 'string' &&
      typeof entry.printing.collectorNumber === 'string' &&
      typeof entry.printing.language === 'string' &&
      Array.isArray(entry.printing.finishes),
  );
}

function isBasicLand(card: DeckCard): boolean {
  return /\bBasic\b/i.test(card.card.definition.typeLine);
}

function canBeCommander(card: DeckCard): boolean {
  const definition = card.card.definition;
  const typeLines = [definition.typeLine, ...(definition.faces?.map((face) => face.typeLine) ?? [])];
  const text = [definition.oracleText, ...(definition.faces?.map((face) => face.oracleText) ?? [])]
    .filter(Boolean)
    .join(' ');
  return (
    typeLines.some((line) => /\bLegendary\b.*\bCreature\b/i.test(line)) ||
    /can be your commander/i.test(text)
  );
}

@Injectable()
export class DecksService {
  private readonly decksById = new Map<string, Deck>();

  create(createDeckDto: CreateDeckDto): Deck {
    const name = createDeckDto?.name?.trim();
    if (!name) throw new BadRequestException('El nombre del mazo es obligatorio');
    if (!isDeckFormat(createDeckDto.format)) {
      throw new BadRequestException("El formato debe ser 'standard' o 'commander'");
    }

    const now = new Date().toISOString();
    const deck: Deck = {
      id: randomUUID(),
      name,
      format: createDeckDto.format,
      description: createDeckDto.description?.trim(),
      cards: [],
      createdAt: now,
      updatedAt: now,
    };
    this.decksById.set(deck.id, deck);
    return deck;
  }

  findAll(): Deck[] {
    return [...this.decksById.values()];
  }

  findOne(id: string): Deck {
    const deck = this.decksById.get(id);
    if (!deck) throw new NotFoundException(`No se encontro el mazo '${id}'`);
    return deck;
  }

  update(id: string, updateDeckDto: UpdateDeckDto): Deck {
    const deck = this.findOne(id);
    if (updateDeckDto.name !== undefined && !updateDeckDto.name.trim()) {
      throw new BadRequestException('El nombre del mazo no puede estar vacio');
    }
    if (updateDeckDto.format !== undefined && !isDeckFormat(updateDeckDto.format)) {
      throw new BadRequestException("El formato debe ser 'standard' o 'commander'");
    }

    const nextFormat = updateDeckDto.format ?? deck.format;
    const candidateDeck = { ...deck, format: nextFormat };
    if (nextFormat !== deck.format) {
      if (nextFormat === 'standard' && deck.cards.some((card) => card.zone === 'commander')) {
        throw new BadRequestException('Quita el comandante antes de cambiar el mazo a Standard');
      }
      for (const card of deck.cards) this.assertFormatLegality(nextFormat, card);
      this.assertCommanderRules(candidateDeck);
      this.assertCopyLimits(candidateDeck);
      this.assertColorIdentity(candidateDeck);
    }

    const updatedDeck: Deck = {
      ...deck,
      name: updateDeckDto.name?.trim() ?? deck.name,
      format: nextFormat,
      description: updateDeckDto.description?.trim() ?? deck.description,
      updatedAt: new Date().toISOString(),
    };
    this.decksById.set(id, updatedDeck);
    return updatedDeck;
  }

  remove(id: string): Deck {
    const deck = this.findOne(id);
    this.decksById.delete(id);
    return deck;
  }

  export(id: string): DeckExportFile {
    const deck = this.findOne(id);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      deck: {
        name: deck.name,
        format: deck.format,
        description: deck.description,
        cards: structuredClone(deck.cards),
      },
    };
  }

  import(importDeckDto: ImportDeckDto): Deck {
    if (importDeckDto?.schemaVersion !== 1 || !importDeckDto.deck) {
      throw new BadRequestException('El archivo no tiene un formato Cardtable compatible');
    }
    if (
      typeof importDeckDto.deck.name !== 'string' ||
      !importDeckDto.deck.name.trim() ||
      !isDeckFormat(importDeckDto.deck.format) ||
      (importDeckDto.deck.description !== undefined && typeof importDeckDto.deck.description !== 'string')
    ) {
      throw new BadRequestException('El nombre, formato o descripcion del mazo no son validos');
    }
    if (!Array.isArray(importDeckDto.deck.cards) || importDeckDto.deck.cards.length > 500) {
      throw new BadRequestException('El archivo debe contener una lista de hasta 500 entradas de cartas');
    }

    const deck = this.create({
      name: importDeckDto.deck.name,
      format: importDeckDto.deck.format,
      description: importDeckDto.deck.description,
    });

    try {
      for (const importedCard of importDeckDto.deck.cards) {
        if (
          !importedCard ||
          !isCatalogEntry(importedCard.card) ||
          importedCard.printingId !== importedCard.card.printing.id ||
          !isDeckCardZone(importedCard.zone) ||
          !Number.isInteger(importedCard.quantity) ||
          importedCard.quantity < 1
        ) {
          throw new BadRequestException('El archivo contiene una entrada de carta invalida');
        }
        this.addCard(deck.id, {
          card: importedCard.card,
          quantity: importedCard.quantity,
          zone: importedCard.zone,
        });
      }
      return this.findOne(deck.id);
    } catch (error) {
      this.decksById.delete(deck.id);
      throw error;
    }
  }

  addCard(deckId: string, addCardDto: AddDeckCardDto): Deck {
    const deck = this.findOne(deckId);
    if (!isCatalogEntry(addCardDto?.card)) {
      throw new BadRequestException('Se requiere la carta del catalogo, incluyendo su impresion');
    }
    const quantity = addCardDto.quantity ?? 1;
    const zone = addCardDto.zone ?? 'mainboard';
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('La cantidad debe ser un entero mayor que cero');
    }
    if (!isDeckCardZone(zone)) throw new BadRequestException('Zona de mazo no valida');
    if (deck.format === 'standard' && zone === 'commander') {
      throw new BadRequestException('Standard no tiene zona de comandante');
    }
    if (zone === 'commander' && quantity !== 1) {
      throw new BadRequestException('El comandante debe tener cantidad 1');
    }

    const newCard: DeckCard = {
      printingId: addCardDto.card.printing.id,
      oracleId: addCardDto.card.definition.oracleId,
      quantity,
      zone,
      card: structuredClone(addCardDto.card),
    };
    this.assertFormatLegality(deck.format, newCard);

    const existingIndex = deck.cards.findIndex((card) => card.printingId === newCard.printingId);
    const cards = [...deck.cards];
    if (existingIndex >= 0) {
      if (cards[existingIndex].zone !== zone) {
        throw new ConflictException('La impresion ya esta en otra zona; usa PATCH para moverla');
      }
      if (zone === 'commander') throw new ConflictException('Ese comandante ya esta en el mazo');
      cards[existingIndex] = {
        ...cards[existingIndex],
        quantity: cards[existingIndex].quantity + quantity,
      };
    } else {
      cards.push(newCard);
    }

    const candidateDeck = { ...deck, cards };
    this.assertCommanderRules(candidateDeck);
    this.assertCopyLimits(candidateDeck);
    this.assertColorIdentity(candidateDeck);
    return this.saveDeck(candidateDeck);
  }

  updateCard(deckId: string, printingId: string, updateDto: UpdateDeckCardDto): Deck {
    const deck = this.findOne(deckId);
    const index = deck.cards.findIndex((card) => card.printingId === printingId);
    if (index < 0) throw new NotFoundException(`La impresion '${printingId}' no esta en el mazo`);

    const currentCard = deck.cards[index];
    const quantity = updateDto.quantity ?? currentCard.quantity;
    const zone = updateDto.zone ?? currentCard.zone;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('La cantidad debe ser un entero mayor que cero');
    }
    if (!isDeckCardZone(zone)) throw new BadRequestException('Zona de mazo no valida');
    if (deck.format === 'standard' && zone === 'commander') {
      throw new BadRequestException('Standard no tiene zona de comandante');
    }
    if (zone === 'commander' && quantity !== 1) {
      throw new BadRequestException('El comandante debe tener cantidad 1');
    }

    const cards = deck.cards.filter((_, cardIndex) => cardIndex !== index);
    const movedCard: DeckCard = { ...currentCard, quantity, zone };
    if (cards.some((card) => card.zone === zone && card.printingId === printingId)) {
      throw new ConflictException('La impresion ya existe en esa zona del mazo');
    }
    cards.push(movedCard);
    const candidateDeck = { ...deck, cards };
    this.assertFormatLegality(deck.format, movedCard);
    this.assertCommanderRules(candidateDeck);
    this.assertCopyLimits(candidateDeck);
    this.assertColorIdentity(candidateDeck);
    return this.saveDeck(candidateDeck);
  }

  removeCard(deckId: string, printingId: string): Deck {
    const deck = this.findOne(deckId);
    const cards = deck.cards.filter((card) => card.printingId !== printingId);
    if (cards.length === deck.cards.length) {
      throw new NotFoundException(`La impresion '${printingId}' no esta en el mazo`);
    }
    return this.saveDeck({ ...deck, cards });
  }

  validate(id: string): DeckValidation {
    const deck = this.findOne(id);
    const issues: string[] = [];
    const commander = deck.cards.find((card) => card.zone === 'commander');
    const mainboardCount = deck.cards
      .filter((card) => card.zone === 'mainboard')
      .reduce((total, card) => total + card.quantity, 0);
    const commanderCount = deck.cards
      .filter((card) => card.zone === 'commander')
      .reduce((total, card) => total + card.quantity, 0);
    const cardCount = deck.format === 'commander' ? mainboardCount + commanderCount : mainboardCount;
    const colorIdentity = [...new Set(deck.cards.flatMap((card) => card.card.definition.colorIdentity))]
      .sort((left, right) => COLOR_ORDER.indexOf(left) - COLOR_ORDER.indexOf(right));

    if (deck.format === 'standard') {
      if (mainboardCount < 60) {
        issues.push(`Standard requiere al menos 60 cartas en el mainboard (actual: ${mainboardCount})`);
      }
      const sideboardCount = deck.cards
        .filter((card) => card.zone === 'sideboard')
        .reduce((total, card) => total + card.quantity, 0);
      if (sideboardCount > 15) {
        issues.push(`El sideboard de Standard permite hasta 15 cartas (actual: ${sideboardCount})`);
      }
    } else {
      if (cardCount !== 100) {
        issues.push(`Commander requiere exactamente 100 cartas incluyendo comandante (actual: ${cardCount})`);
      }
      if (commanderCount !== 1) {
        issues.push(`Commander requiere exactamente un comandante (actual: ${commanderCount})`);
      }
      if (commander && !canBeCommander(commander)) {
        issues.push(`${commander.card.definition.name} no parece ser un comandante valido`);
      }
    }

    this.collectLegalityIssues(deck, issues);
    this.collectSingletonIssues(deck, issues);
    this.collectStandardCopyIssues(deck, issues);
    this.collectColorIdentityIssues(deck, commander, issues);

    return {
      valid: issues.length === 0,
      format: deck.format,
      cardCount,
      expectedCardCount: deck.format === 'standard' ? '60 o mas' : '100 incluyendo comandante',
      commander,
      colorIdentity,
      issues,
    };
  }

  statistics(id: string): DeckStatistics {
    const deck = this.findOne(id);
    const mainboard = deck.cards.filter((card) => card.zone === 'mainboard');
    const colors: DeckStatistics['colors'] = {
      Blanco: 0,
      Azul: 0,
      Negro: 0,
      Rojo: 0,
      Verde: 0,
    };
    const cardTypes: Record<string, number> = {};
    const manaCurve: Record<string, number> = {
      '0': 0,
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0,
      '7+': 0,
    };

    for (const card of mainboard) {
      for (const color of card.card.definition.colors) {
        colors[color] += card.quantity;
      }
      for (const type of ['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Planeswalker', 'Land', 'Battle']) {
        if (new RegExp(`\\b${type}\\b`, 'i').test(card.card.definition.typeLine)) {
          cardTypes[type] = (cardTypes[type] ?? 0) + card.quantity;
        }
      }
      if (!/\bLand\b/i.test(card.card.definition.typeLine)) {
        const manaValue = card.card.definition.manaValue;
        const bucket = manaValue >= 7 ? '7+' : String(Math.max(0, Math.floor(manaValue)));
        manaCurve[bucket] = (manaCurve[bucket] ?? 0) + card.quantity;
      }
    }

    const countZone = (zone: DeckCardZone) =>
      deck.cards.filter((card) => card.zone === zone).reduce((total, card) => total + card.quantity, 0);
    const mainboardCount = countZone('mainboard');
    const sideboardCount = countZone('sideboard');
    const commanderCount = countZone('commander');

    return {
      totalCards: mainboardCount + sideboardCount + commanderCount,
      mainboardCount,
      sideboardCount,
      commanderCount,
      colors,
      cardTypes,
      manaCurve,
    };
  }

  private assertFormatLegality(format: DeckFormat, deckCard: DeckCard): void {
    const legalityKey = format === 'standard' ? 'standard' : 'commander';
    if (deckCard.card.definition.legalities[legalityKey] !== 'legal') {
      throw new BadRequestException(`${deckCard.card.definition.name} no esta marcada como legal en ${format}`);
    }
  }

  private assertCommanderRules(deck: Deck): void {
    const commanders = deck.cards.filter((card) => card.zone === 'commander');
    if (commanders.length > 1) throw new BadRequestException('Este MVP permite un solo comandante');
    if (commanders.some((card) => card.quantity !== 1)) {
      throw new BadRequestException('El comandante debe tener cantidad 1');
    }
    if (commanders[0] && !canBeCommander(commanders[0])) {
      throw new BadRequestException(`${commanders[0].card.definition.name} no parece ser un comandante valido`);
    }
  }

  private assertColorIdentity(deck: Deck): void {
    const commander = deck.cards.find((card) => card.zone === 'commander');
    if (!commander) return;
    const commanderIdentity = new Set(commander.card.definition.colorIdentity);
    const illegalCard = deck.cards.find((card) =>
      card.card.definition.colorIdentity.some((color) => !commanderIdentity.has(color)),
    );
    if (illegalCard) {
      throw new BadRequestException(
        `${illegalCard.card.definition.name} excede la identidad de color de ${commander.card.definition.name}`,
      );
    }
  }

  private collectLegalityIssues(deck: Deck, issues: string[]): void {
    const legalityKey = deck.format === 'standard' ? 'standard' : 'commander';
    for (const card of deck.cards) {
      if (card.card.definition.legalities[legalityKey] !== 'legal') {
        issues.push(`${card.card.definition.name} no esta marcada como legal en ${deck.format}`);
      }
    }
  }

  private collectSingletonIssues(deck: Deck, issues: string[]): void {
    if (deck.format !== 'commander') return;
    const copiesByOracleId = new Map<string, number>();
    for (const card of deck.cards) {
      if (isBasicLand(card)) continue;
      const key = card.oracleId ?? card.card.definition.name.toLocaleLowerCase();
      copiesByOracleId.set(key, (copiesByOracleId.get(key) ?? 0) + card.quantity);
    }
    for (const [oracleId, quantity] of copiesByOracleId) {
      if (quantity > 1) {
        const name = deck.cards.find(
          (card) => (card.oracleId ?? card.card.definition.name.toLocaleLowerCase()) === oracleId,
        )?.card.definition.name;
        issues.push(`Commander permite una copia de cada carta (excepto tierras basicas): ${name}`);
      }
    }
  }

  private assertCopyLimits(deck: Deck): void {
    const issues: string[] = [];
    if (deck.format === 'commander') this.collectSingletonIssues(deck, issues);
    else this.collectStandardCopyIssues(deck, issues);
    if (issues.length > 0) throw new BadRequestException(issues[0]);
  }

  private collectStandardCopyIssues(deck: Deck, issues: string[]): void {
    if (deck.format !== 'standard') return;
    const copiesByOracleId = new Map<string, { quantity: number; name: string }>();
    for (const card of deck.cards) {
      if (isBasicLand(card)) continue;
      const key = card.oracleId ?? card.card.definition.name.toLocaleLowerCase();
      const current = copiesByOracleId.get(key) ?? { quantity: 0, name: card.card.definition.name };
      current.quantity += card.quantity;
      copiesByOracleId.set(key, current);
    }
    for (const { quantity, name } of copiesByOracleId.values()) {
      if (quantity > 4) {
        issues.push(`Standard permite hasta 4 copias de ${name} (excepto tierras basicas)`);
      }
    }
  }

  private collectColorIdentityIssues(
    deck: Deck,
    commander: DeckCard | undefined,
    issues: string[],
  ): void {
    if (deck.format !== 'commander' || !commander) return;
    const commanderIdentity = new Set(commander.card.definition.colorIdentity);
    for (const card of deck.cards) {
      if (card.card.definition.colorIdentity.some((color) => !commanderIdentity.has(color))) {
        issues.push(`${card.card.definition.name} excede la identidad de color de ${commander.card.definition.name}`);
      }
    }
  }

  private saveDeck(deck: Deck): Deck {
    const updatedDeck: Deck = { ...deck, updatedAt: new Date().toISOString() };
    this.decksById.set(deck.id, updatedDeck);
    return updatedDeck;
  }
}