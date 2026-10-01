import type { DeckCardZone } from '../entities/deck.entity.js';

export class UpdateDeckCardDto {
  public quantity?: number;
  public zone?: DeckCardZone;
}