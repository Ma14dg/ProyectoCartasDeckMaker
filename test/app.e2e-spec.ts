import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('creates a deck and returns its basic validation report', async () => {
    const response = await request(app.getHttpServer())
      .post('/decks')
      .send({ name: 'E2E Commander', format: 'commander' })
      .expect(201);

    expect(response.body.name).toBe('E2E Commander');
    expect(response.body.cards).toEqual([]);

    const validationResponse = await request(app.getHttpServer())
      .get(`/decks/${response.body.id}/validation`)
      .expect(200);

    expect(validationResponse.body.valid).toBe(false);
    expect(validationResponse.body.cardCount).toBe(0);
    expect(validationResponse.body.issues).toContain(
      'Commander requiere exactamente 100 cartas incluyendo comandante (actual: 0)',
    );
  });

  it('exports and imports a versioned deck backup', async () => {
    const created = await request(app.getHttpServer())
      .post('/decks')
      .send({ name: 'Backup e2e', format: 'standard' })
      .expect(201);

    const exported = await request(app.getHttpServer())
      .get(`/decks/${created.body.id}/export`)
      .expect(200);

    expect(exported.body.schemaVersion).toBe(1);
    expect(exported.body.deck.name).toBe('Backup e2e');

    const imported = await request(app.getHttpServer())
      .post('/decks/import')
      .send(exported.body)
      .expect(201);

    expect(imported.body.id).not.toBe(created.body.id);
    expect(imported.body.name).toBe('Backup e2e');
    expect(imported.body.cards).toEqual([]);
  });

  afterEach(async () => {
    await app.close();
  });
});
