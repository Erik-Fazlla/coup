import React from 'react';
import { Vibration } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { render } from '../../components/testUtils';
import { makeGame, play } from '../../engine/testHelpers';
import { Game } from '../../engine/types';
import { BUZZ_PATTERN, buzzMoment, useTurnBuzz } from '../turnBuzz';

const table = () =>
  makeGame(
    {
      me: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
      c: ['Ambassador', 'Duke'],
    },
    { coins: { me: 2, b: 7 } },
  );

/** B acts first, so `me` only responds. */
const theirTurn = () =>
  makeGame(
    {
      b: ['Contessa', 'Assassin'],
      me: ['Duke', 'Captain'],
      c: ['Ambassador', 'Duke'],
    },
    { coins: { b: 7 } },
  );

describe('buzzMoment', () => {
  it('is my turn when I am the one to act', () => {
    expect(buzzMoment(table(), 'me')?.kind).toBe('turn');
  });

  it('is nothing on another player turn', () => {
    expect(buzzMoment(theirTurn(), 'me')).toBeNull();
    expect(buzzMoment(table(), 'b')).toBeNull();
  });

  it('is nothing without a game, in the lobby or after the end', () => {
    expect(buzzMoment(null, 'me')).toBeNull();
    expect(buzzMoment({ ...table(), status: 'waiting' }, 'me')).toBeNull();
    expect(buzzMoment({ ...table(), status: 'finished' }, 'me')).toBeNull();
  });

  it('asks me to respond to a claim, but not the player who made it', () => {
    const game = play(theirTurn(), { type: 'tax', playerId: 'b' });
    expect(buzzMoment(game, 'me')?.kind).toBe('respond');
    expect(buzzMoment(game, 'c')?.kind).toBe('respond');
    expect(buzzMoment(game, 'b')).toBeNull();
  });

  it('stops asking once I have responded', () => {
    const game = play(
      theirTurn(),
      { type: 'tax', playerId: 'b' },
      { type: 'pass', playerId: 'me' },
    );
    expect(buzzMoment(game, 'me')).toBeNull();
  });

  it('keeps the same key while others respond to the same claim', () => {
    const asked = play(theirTurn(), { type: 'tax', playerId: 'b' });
    const onePassed = play(asked, { type: 'pass', playerId: 'c' });
    expect(buzzMoment(onePassed, 'me')?.key).toBe(buzzMoment(asked, 'me')?.key);
  });

  it('tells me when I must lose a card, and only me', () => {
    const game = play(theirTurn(), {
      type: 'coup',
      playerId: 'b',
      target: 'me',
    });
    expect(buzzMoment(game, 'me')?.kind).toBe('lose');
    expect(buzzMoment(game, 'b')).toBeNull();
    expect(buzzMoment(game, 'c')).toBeNull();
  });

  it('tells me when I must choose exchange cards', () => {
    const game = play(
      table(),
      { type: 'exchange', playerId: 'me' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(buzzMoment(game, 'me')?.kind).toBe('exchange');
    expect(buzzMoment(game, 'b')).toBeNull();
  });

  it('gives every new moment a new key', () => {
    const first = table();
    const second = { ...table(), state: { ...first.state, turnNumber: 4 } };
    const nextRound = { ...table(), round: 2 };
    const keys = [first, second, nextRound].map(
      game => buzzMoment(game, 'me')?.key,
    );
    expect(new Set(keys).size).toBe(3);
  });

  it('uses two pulses for a turn, one for a response and a long one for a loss', () => {
    expect(BUZZ_PATTERN.turn).toEqual([0, 90, 130, 90]);
    expect(typeof BUZZ_PATTERN.respond).toBe('number');
    expect(BUZZ_PATTERN.lose).toBeGreaterThan(
      (BUZZ_PATTERN.respond as number) * 3,
    );
  });
});

describe('useTurnBuzz', () => {
  let vibrate: jest.SpyInstance;

  function Probe({ game, enabled }: { game: Game | null; enabled: boolean }) {
    useTurnBuzz(game, 'me', enabled);
    return null;
  }

  const deliver = (
    renderer: ReactTestRenderer,
    game: Game | null,
    enabled = true,
  ) =>
    act(() => {
      renderer.update(<Probe game={game} enabled={enabled} />);
    });

  beforeEach(() => {
    vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
  });

  afterEach(() => {
    vibrate.mockRestore();
  });

  it('buzzes once when my turn starts and stays quiet on later snapshots', () => {
    const renderer = render(<Probe game={theirTurn()} enabled />);
    expect(vibrate).not.toHaveBeenCalled();

    deliver(renderer, table());
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(BUZZ_PATTERN.turn);

    // The same moment arriving again, as a new object each time.
    deliver(renderer, table());
    deliver(renderer, { ...table(), log: ['something was logged'] });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('does not buzz again when another player answers the claim I am asked about', () => {
    const asked = play(theirTurn(), { type: 'tax', playerId: 'b' });
    const renderer = render(<Probe game={asked} enabled />);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenLastCalledWith(BUZZ_PATTERN.respond);

    deliver(renderer, play(asked, { type: 'pass', playerId: 'c' }));
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('never buzzes for another player moment', () => {
    const renderer = render(<Probe game={theirTurn()} enabled />);
    deliver(
      renderer,
      play(theirTurn(), { type: 'coup', playerId: 'b', target: 'c' }),
    );
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('uses the long pulse when I must lose a card', () => {
    const renderer = render(<Probe game={theirTurn()} enabled />);
    deliver(
      renderer,
      play(theirTurn(), { type: 'coup', playerId: 'b', target: 'me' }),
    );
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(BUZZ_PATTERN.lose);
  });

  it('buzzes for each new moment', () => {
    const renderer = render(<Probe game={table()} enabled />);
    expect(vibrate).toHaveBeenCalledTimes(1);
    deliver(renderer, theirTurn());
    const later = table();
    later.state.turnNumber = 4;
    deliver(renderer, later);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('is silent when vibration is switched off, and does not replay when switched on', () => {
    const renderer = render(<Probe game={theirTurn()} enabled={false} />);
    deliver(renderer, table(), false);
    expect(vibrate).not.toHaveBeenCalled();
    deliver(renderer, table(), true);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('survives a phone that cannot vibrate', () => {
    vibrate.mockImplementation(() => {
      throw new Error('no vibrator');
    });
    expect(() => render(<Probe game={table()} enabled />)).not.toThrow();
  });
});
