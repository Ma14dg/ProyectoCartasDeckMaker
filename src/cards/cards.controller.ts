import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  BadRequestException,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { CardsService } from './cards.service.js';
import { ScryfallService } from './scryfall.service.js';
import { CreateCardDto } from './dto/create-card.dto.js';
import { UpdateCardDto } from './dto/update-card.dto.js';
import { SearchCardsDto } from './dto/search-cards.dto.js';

@Controller('cards')
export class CardsController {
  constructor(
    private readonly cardsService: CardsService,
    private readonly scryfallService: ScryfallService,
  ) {}

  @Post()
  create(@Body() createCardDto: CreateCardDto) {
    return this.cardsService.create(createCardDto);
  }

  @Get()
  findAll() {
    return this.cardsService.findAll();
  }

  @Get('search')
  search(@Query() filters: SearchCardsDto) {
    const pageValue = filters.page ?? '1';
    if (!/^\d+$/.test(pageValue) || Number(pageValue) < 1) {
      throw new BadRequestException('page debe ser un entero mayor o igual a 1');
    }
    const page = Number(pageValue);
    const queryParts = [filters.q?.trim()].filter((part): part is string => Boolean(part));
    const addTextFilter = (operator: string, value?: string) => {
      const normalized = value?.trim();
      if (normalized) queryParts.push(`${operator}:"${normalized.replace(/["\\]/g, '\\$&')}"`);
    };

    addTextFilter('name', filters.name);
    addTextFilter('type', filters.type);
    addTextFilter('oracle', filters.oracle);

    if (filters.color) {
      if (!/^[WUBRGC]+$/i.test(filters.color)) {
        throw new BadRequestException('color solo acepta los codigos W, U, B, R, G y C');
      }
      queryParts.push(`color:${filters.color.toUpperCase()}`);
    }
    if (filters.identity) {
      if (!/^[WUBRG]+$/i.test(filters.identity)) {
        throw new BadRequestException('identity solo acepta los codigos W, U, B, R y G');
      }
      queryParts.push(`id<=${filters.identity.toUpperCase()}`);
    }
    if (filters.manaValue) {
      if (!/^(?:<=|>=|<|>|=)?\d+(?:\.\d+)?$/.test(filters.manaValue)) {
        throw new BadRequestException('manaValue debe ser un numero o comparacion, por ejemplo <=3');
      }
      queryParts.push(`mv${/^[<>=]/.test(filters.manaValue) ? '' : '='}${filters.manaValue}`);
    }
    if (filters.set) {
      if (!/^[a-z0-9]{2,6}$/i.test(filters.set)) {
        throw new BadRequestException('set debe ser un codigo de expansion de 2 a 6 caracteres');
      }
      queryParts.push(`set:${filters.set.toLowerCase()}`);
    }

    if (queryParts.length === 0) {
      throw new BadRequestException('Indica q o al menos un filtro de busqueda');
    }
    return this.scryfallService.search(queryParts.join(' '), page);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cardsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() updateCardDto: UpdateCardDto) {
    return this.cardsService.update(id, updateCardDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.cardsService.remove(id);
  }
}
