import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { CreateCardDto } from './dto/create-card.dto.js';
import { UpdateCardDto } from './dto/update-card.dto.js';
import type { CardCatalogEntry } from './entities/card-catalog.entity.js';

@Injectable()
export class CardsService {

  private readonly cardsByPrintingId = new Map<string, CardCatalogEntry>();

  create(createCardDto: CreateCardDto) {
    if (!createCardDto?.definition || !createCardDto?.printing) {
      throw new BadRequestException('Se requieren definition y printing');
    }
    const id = createCardDto.printing.id;
    if (typeof id !== 'string' || id.length === 0) {
      throw new BadRequestException('printing.id es obligatorio');
    }
    if (this.cardsByPrintingId.has(id)) {
      throw new ConflictException(`Ya existe una impresion con el id '${id}'`);
    }

    const newCard: CardCatalogEntry = {
      definition: { ...createCardDto.definition },
      printing: { ...createCardDto.printing },
    };
    this.cardsByPrintingId.set(id, newCard);

    return newCard;
  }

  findAll() {
    return [...this.cardsByPrintingId.values()];
  }

  findOne(id: string) {
    const card = this.cardsByPrintingId.get(id);
    if (!card) {
      throw new NotFoundException(`No se encontro una impresion con el id '${id}'`);
    }
    return card;
  }

  update(id: string, updateCardDto: UpdateCardDto) {
    const existingCard = this.cardsByPrintingId.get(id);
    if (!existingCard) {
      throw new NotFoundException(`No se encontro una impresion con el id '${id}'`);
    }

    const updatedCard: CardCatalogEntry = {
      definition: {
        ...existingCard.definition,
        ...updateCardDto.definition,
      },
      printing: {
        ...existingCard.printing,
        ...updateCardDto.printing,
        id,
      },
    };
    this.cardsByPrintingId.set(id, updatedCard);
    return updatedCard;
  }

  remove(id: string) {
    const card = this.cardsByPrintingId.get(id);
    if (!card) {
      throw new NotFoundException(`No se encontro una impresion con el id '${id}'`);
    }
    this.cardsByPrintingId.delete(id);
    return card;
  }
}
