import type { CardCatalogEntry } from '../../cards/entities/card-catalog.entity.js';
import type { ColorMagic } from '../../cards/ultilitis/colorMagic.js';

export type DeckFormat = 'standard' | 'commander';
export type DeckCardZone = 'mainboard' | 'sideboard' | 'commander';

export interface DeckCard {
  printingId: string;
  oracleId?: string;
  quantity: number;
  zone: DeckCardZone;
  card: CardCatalogEntry;
}

export interface Deck {
  id: string;
  name: string;
  format: DeckFormat;
  description?: string;
  cards: DeckCard[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckValidation {
  valid: boolean;
  format: DeckFormat;
  cardCount: number;
  expectedCardCount: string;
  commander?: DeckCard;
  colorIdentity: string[];
  issues: string[];
}

export interface DeckStatistics {
  totalCards: number;
  mainboardCount: number;
  sideboardCount: number;
  commanderCount: number;
  colors: Record<ColorMagic, number>;
  cardTypes: Record<string, number>;
  manaCurve: Record<string, number>;
}

export interface DeckExportFile {
  schemaVersion: 1;
  exportedAt: string;
  deck: {
    name: string;
    format: DeckFormat;
    description?: string;
    cards: DeckCard[];
  };
}