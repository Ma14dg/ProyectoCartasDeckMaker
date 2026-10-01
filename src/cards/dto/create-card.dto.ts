import type { CardDefinition, CardPrinting } from '../entities/card-catalog.entity.js';

export class CreateCardDto {
  public definition: CardDefinition;
  public printing: CardPrinting;
}