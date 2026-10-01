import type { DeckExportFile } from '../entities/deck.entity.js';

export class ImportDeckDto implements DeckExportFile {
  public schemaVersion: 1;
  public exportedAt: string;
  public deck: DeckExportFile['deck'];
}