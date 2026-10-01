import type { DeckFormat } from '../entities/deck.entity.js';

export class UpdateDeckDto {
  public name?: string;
  public format?: DeckFormat;
  public description?: string;
}