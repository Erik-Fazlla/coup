import { makeGame, play } from '../../engine/testHelpers';
import { Game } from '../../engine/types';
import {
  dealId,
  isDealSnapshot,
  seatMoment,
  tableMoments,
} from '../tableMoments';

/** B acts first. */
const table = (): Game =>
  makeGame(
    {
      b: ['Contessa', 'Assassin'],
      me: ['Duke', 'Captain'],
      c: ['Ambassador', 'Duke'],
    },
    { coins: { b: 7 } },
  );

describe('tableMoments', () => {
  it('deals on the first snapshot of a game that has just started, and nothing else', () => {
    const start = table();
    expect(isDealSnapshot(start)).toBe(true);
    expect(tableMoments(null, start)).toEqual([{ kind: 'deal' }]);
    const later = play(start, { type: 'income', playerId: 'b' });
    expect(tableMoments(null, later)).toEqual([]);
  });

  it('shows coin changes for every player they changed for', () => {
    const before = table();
    const after = play(before, { type: 'income', playerId: 'b' });
    expect(tableMoments(before, after)).toEqual([
      { kind: 'coins', playerId: 'b', delta: 1 },
    ]);
  });

  it('tags the claim when an action opens for responses', () => {
    const before = table();
    const claimed = play(before, { type: 'tax', playerId: 'b' });
    expect(tableMoments(before, claimed)).toContainEqual({
      kind: 'claim',
      playerId: 'b',
      label: 'TAX · Duke',
    });
    // The same claim is not tagged again while others answer.
    expect(tableMoments(claimed, { ...claimed, log: [] })).toEqual([]);
  });

  it('flashes the blocker when a block is declared', () => {
    const stolen = play(table(), {
      type: 'steal',
      playerId: 'b',
      target: 'me',
    });
    const blocked = play(stolen, {
      type: 'block',
      playerId: 'me',
      claim: 'Captain',
    });
    expect(tableMoments(stolen, blocked)).toContainEqual({
      kind: 'block',
      playerId: 'me',
      label: 'BLOCK · Captain',
    });
  });

  it('treats another round or another game like a first snapshot', () => {
    const before = play(table(), { type: 'income', playerId: 'b' });
    const other = { ...table(), round: 2 };
    expect(tableMoments(before, other)).toEqual([{ kind: 'deal' }]);
  });

  it('never names a hidden card', () => {
    const before = table();
    const after = play(before, { type: 'tax', playerId: 'b' });
    const text = JSON.stringify(tableMoments(before, after));
    // B holds Contessa and Assassin; only the claimed Duke may appear.
    expect(text).not.toContain('Contessa');
    expect(text).not.toContain('Assassin');
  });
});

describe('seatMoment', () => {
  it('gathers one player’s part of a batch', () => {
    const batch = {
      seq: 3,
      moments: [
        { kind: 'coins' as const, playerId: 'b', delta: -2 },
        { kind: 'claim' as const, playerId: 'b', label: 'STEAL · Captain' },
        { kind: 'coins' as const, playerId: 'c', delta: 2 },
      ],
    };
    expect(seatMoment(batch, 'b')).toEqual({
      id: 3,
      coins: -2,
      tag: 'STEAL · Captain',
      block: false,
    });
    expect(seatMoment(batch, 'me')).toBeNull();
  });
});

describe('dealId', () => {
  it('names the batch of the latest deal', () => {
    expect(dealId({ seq: 4, moments: [{ kind: 'deal' }] })).toBe(4);
    expect(
      dealId({ seq: 5, moments: [{ kind: 'coins', playerId: 'b', delta: 1 }] }),
    ).toBeNull();
  });
});
