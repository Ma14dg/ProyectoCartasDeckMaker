import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AddDeckCardDto } from './dto/add-deck-card.dto.js';
import { CreateDeckDto } from './dto/create-deck.dto.js';
import { ImportDeckDto } from './dto/import-deck.dto.js';
import { UpdateDeckCardDto } from './dto/update-deck-card.dto.js';
import { UpdateDeckDto } from './dto/update-deck.dto.js';
import { DecksService } from './decks.service.js';

@Controller('decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  @Post('import')
  import(@Body() importDeckDto: ImportDeckDto) {
    return this.decksService.import(importDeckDto);
  }

  @Post()
  create(@Body() createDeckDto: CreateDeckDto) {
    return this.decksService.create(createDeckDto);
  }

  @Get()
  findAll() {
    return this.decksService.findAll();
  }

  @Get(':id/validation')
  validate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.decksService.validate(id);
  }

  @Get(':id/export')
  export(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.decksService.export(id);
  }

  @Get(':id/statistics')
  statistics(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.decksService.statistics(id);
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.decksService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateDeckDto: UpdateDeckDto,
  ) {
    return this.decksService.update(id, updateDeckDto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.decksService.remove(id);
  }

  @Post(':id/cards')
  addCard(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() addDeckCardDto: AddDeckCardDto,
  ) {
    return this.decksService.addCard(id, addDeckCardDto);
  }

  @Patch(':id/cards/:printingId')
  updateCard(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('printingId', new ParseUUIDPipe()) printingId: string,
    @Body() updateDeckCardDto: UpdateDeckCardDto,
  ) {
    return this.decksService.updateCard(id, printingId, updateDeckCardDto);
  }

  @Delete(':id/cards/:printingId')
  removeCard(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('printingId', new ParseUUIDPipe()) printingId: string,
  ) {
    return this.decksService.removeCard(id, printingId);
  }
}
