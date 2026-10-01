import type { DeckFormat } from '../entities/deck.entity.js';

export class CreateDeckDto {
  public name: string;
  public format: DeckFormat;
  public description?: string;
}