import type { ColorMagic, ColorMana, RarezaCarta } from '../ultilitis/index.js';

export interface CardFaceDefinition {
  name: string;
  manaCost?: string;
  colors: ColorMagic[];
  typeLine: string;
  oracleText?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  imageUris?: Record<string, string>;
}

export interface CardDefinition {
  oracleId?: string;
  name: string;
  layout?: string;
  manaCost?: string;
  manaValue: number;
  colors: ColorMagic[];
  colorIdentity: ColorMagic[];
  typeLine: string;
  oracleText?: string;
  keywords: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  producedMana: ColorMana[];
  faces?: CardFaceDefinition[];
  legalities: Record<string, string>;
}

export interface CardPrinting {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  language: string;
  releasedAt?: string;
  rarity: RarezaCarta;
  finishes: string[];
  artist?: string;
  imageUris?: Record<string, string>;
}

export interface CardCatalogEntry {
  definition: CardDefinition;
  printing: CardPrinting;
}

export interface CardSearchResult {
  totalCards: number;
  hasMore: boolean;
  nextPage: string | null;
  data: CardCatalogEntry[];
}