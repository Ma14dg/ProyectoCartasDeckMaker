import type { CardDefinition, CardPrinting } from '../entities/card-catalog.entity.js';

export class UpdateCardDto {
	public definition?: Partial<CardDefinition>;
	public printing?: Partial<CardPrinting>;
}
