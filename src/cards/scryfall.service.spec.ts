import { BadRequestException, BadGatewayException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScryfallService } from './scryfall.service.js';

const scryfallCard = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  oracle_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  name: 'Lightning Bolt',
  layout: 'normal',
  mana_cost: '{R}',
  cmc: 1,
  colors: ['R'],
  color_identity: ['R'],
  type_line: 'Instant',
  oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  keywords: [],
  produced_mana: ['C'],
  legalities: { modern: 'legal' },
  set: 'lea',
  set_name: 'Limited Edition Alpha',
  collector_number: '161',
  lang: 'en',
  released_at: '1993-08-05',
  rarity: 'common',
  finishes: ['nonfoil'],
  artist: 'Christopher Rush',
  image_uris: { normal: 'https://example.test/lightning-bolt.jpg' },
};

describe('ScryfallService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('normalizes card rules separately from a printing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total_cards: 1,
          has_more: false,
          data: [scryfallCard],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new ScryfallService().search('lightning bolt');

    expect(result.totalCards).toBe(1);
    expect(result.data[0]).toMatchObject({
      definition: {
        oracleId: scryfallCard.oracle_id,
        name: 'Lightning Bolt',
        colors: ['Rojo'],
        colorIdentity: ['Rojo'],
        producedMana: ['Incoloro'],
      },
      printing: {
        id: scryfallCard.id,
        setCode: 'lea',
        rarity: 'Comun',
      },
    });

    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as URL);
    expect(requestedUrl.searchParams.get('q')).toBe('lightning bolt');
    expect(requestedUrl.searchParams.get('unique')).toBe('prints');
  });

  it('returns an empty page when Scryfall finds no cards', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(new ScryfallService().search('no-such-card-name')).resolves.toMatchObject({
      totalCards: 0,
      hasMore: false,
      data: [],
    });
  });

  it('rejects an empty query before calling Scryfall', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(new ScryfallService().search('  ')).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports upstream errors as a gateway error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(new ScryfallService().search('lightning bolt')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});