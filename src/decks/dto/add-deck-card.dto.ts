import type { CardCatalogEntry } from '../../cards/entities/card-catalog.entity.js';
import type { DeckCardZone } from '../entities/deck.entity.js';

export class AddDeckCardDto {
  public card: CardCatalogEntry;
  public quantity?: number;
  public zone?: DeckCardZone;
}