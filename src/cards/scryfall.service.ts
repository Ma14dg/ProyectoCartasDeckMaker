import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import type {
  CardCatalogEntry,
  CardDefinition,
  CardFaceDefinition,
  CardPrinting,
  CardSearchResult,
} from './entities/card-catalog.entity.js';
import type { ColorMagic, ColorMana, RarezaCarta } from './ultilitis/index.js';

interface ScryfallFaceResponse {
  name: string;
  mana_cost?: string;
  colors?: string[];
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  image_uris?: Record<string, string>;
}

interface ScryfallCardResponse {
  id: string;
  oracle_id?: string;
  name: string;
  layout?: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  type_line?: string;
  oracle_text?: string;
  keywords?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  produced_mana?: string[];
  card_faces?: ScryfallFaceResponse[];
  legalities?: Record<string, string>;
  set: string;
  set_name: string;
  collector_number: string;
  lang: string;
  released_at?: string;
  rarity?: string;
  finishes?: string[];
  artist?: string;
  image_uris?: Record<string, string>;
}

interface ScryfallSearchResponse {
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: ScryfallCardResponse[];
}

const COLOR_BY_CODE: Record<string, ColorMagic> = {
  W: 'Blanco',
  U: 'Azul',
  B: 'Negro',
  R: 'Rojo',
  G: 'Verde',
};

const RARITY_BY_CODE: Record<string, RarezaCarta> = {
  common: 'Comun',
  uncommon: 'Infrecuente',
  rare: 'Rara',
  mythic: 'Mitica',
  special: 'Especial',
  bonus: 'Bonus',
};

function mapColors(codes: string[] = []): ColorMagic[] {
  return codes.flatMap((code) => (COLOR_BY_CODE[code] ? [COLOR_BY_CODE[code]] : []));
}

function mapProducedMana(codes: string[] = []): ColorMana[] {
  return codes.flatMap((code) => {
    if (code === 'C') return ['Incoloro'];
    return COLOR_BY_CODE[code] ? [COLOR_BY_CODE[code]] : [];
  });
}

function mapFace(face: ScryfallFaceResponse): CardFaceDefinition {
  return {
    name: face.name,
    manaCost: face.mana_cost,
    colors: mapColors(face.colors),
    typeLine: face.type_line,
    oracleText: face.oracle_text,
    power: face.power,
    toughness: face.toughness,
    loyalty: face.loyalty,
    defense: face.defense,
    imageUris: face.image_uris,
  };
}

function mapCard(raw: ScryfallCardResponse): CardCatalogEntry {
  const definition: CardDefinition = {
    oracleId: raw.oracle_id,
    name: raw.name,
    layout: raw.layout,
    manaCost: raw.mana_cost,
    manaValue: raw.cmc ?? 0,
    colors: mapColors(raw.colors),
    colorIdentity: mapColors(raw.color_identity),
    typeLine: raw.type_line ?? '',
    oracleText: raw.oracle_text,
    keywords: raw.keywords ?? [],
    power: raw.power,
    toughness: raw.toughness,
    loyalty: raw.loyalty,
    defense: raw.defense,
    producedMana: mapProducedMana(raw.produced_mana),
    faces: raw.card_faces?.map(mapFace),
    legalities: raw.legalities ?? {},
  };

  const printing: CardPrinting = {
    id: raw.id,
    setCode: raw.set,
    setName: raw.set_name,
    collectorNumber: raw.collector_number,
    language: raw.lang,
    releasedAt: raw.released_at,
    rarity: RARITY_BY_CODE[raw.rarity ?? ''] ?? 'Especial',
    finishes: raw.finishes ?? [],
    artist: raw.artist,
    imageUris: raw.image_uris,
  };

  return { definition, printing };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSearchResponse(value: unknown): value is ScryfallSearchResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.total_cards === 'number' &&
    typeof value.has_more === 'boolean' &&
    Array.isArray(value.data) &&
    value.data.every(
      (card) =>
        isRecord(card) &&
        typeof card.id === 'string' &&
        typeof card.name === 'string' &&
        typeof card.set === 'string' &&
        typeof card.set_name === 'string' &&
        typeof card.collector_number === 'string' &&
        typeof card.lang === 'string',
    )
  );
}

@Injectable()
export class ScryfallService {
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  async search(query: string, page = 1): Promise<CardSearchResult> {
    const normalizedQuery = query?.trim();
    if (!normalizedQuery) {
      throw new BadRequestException('El parametro q no puede estar vacio');
    }
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('page debe ser un entero mayor o igual a 1');
    }

    const url = new URL('https://api.scryfall.com/cards/search');
    url.searchParams.set('q', normalizedQuery);
    url.searchParams.set('unique', 'prints');
    url.searchParams.set('page', String(page));

    try {
      const response = await this.fetchScryfall(url);
      if (response.status === 404) {
        return { totalCards: 0, hasMore: false, nextPage: null, data: [] };
      }
      if (!response.ok) {
        throw new BadGatewayException(`Scryfall respondio con estado ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (!isSearchResponse(payload)) {
        throw new BadGatewayException('Scryfall devolvio una respuesta inesperada');
      }

      return {
        totalCards: payload.total_cards,
        hasMore: payload.has_more,
        nextPage: payload.next_page ?? null,
        data: payload.data.map(mapCard),
      };
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('Scryfall no respondio a tiempo');
      }
      throw new BadGatewayException('No fue posible consultar Scryfall');
    }
  }

  private fetchScryfall(url: URL): Promise<Response> {
    const request = this.requestQueue.then(async () => {
      const elapsedSinceLastRequest = Date.now() - this.lastRequestAt;
      const waitMilliseconds = Math.max(0, 100 - elapsedSinceLastRequest);
      if (waitMilliseconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
      }
      this.lastRequestAt = Date.now();

      return fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'proyecto-cartas/0.0.1',
        },
        signal: AbortSignal.timeout(10_000),
      });
    });
    this.requestQueue = request.then(
      () => undefined,
      () => undefined,
    );
    return request;
  }
}