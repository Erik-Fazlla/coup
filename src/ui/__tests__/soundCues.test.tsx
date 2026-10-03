import React from 'react';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { render } from '../../components/testUtils';
import { LooseAction, makeGame, play } from '../../engine/testHelpers';
import { Game } from '../../engine/types';
import { playSound, SoundName } from '../sound';
import { soundCues, useGameSounds } from '../soundCues';
import { buzzMoment } from '../turnBuzz';

let mockSound = true;

jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { vibration: true, sound: mockSound },
    update: jest.fn(),
  }),
}));
jest.mock('../sound', () => ({ playSound: jest.fn() }));

const played = () =>
  (playSound as jest.Mock).mock.calls.map(call => call[0] as SoundName);

/** I act first. */
const table = () =>
  makeGame(
    {
      me: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
      c: ['Ambassador', 'Duke'],
    },
    { coins: { me: 2, b: 7 } },
  );

/** B acts first, then me, then C. */
const theirTurn = () =>
  makeGame(
    {
      b: ['Contessa', 'Assassin'],
      me: ['Duke', 'Captain'],
      c: ['Ambassador', 'Duke'],
    },
    { coins: { b: 7 } },
  );

/** Two players, one card each, and B can afford a coup: one move from the end. */
function lastCards(): Game {
  const game = makeGame(
    { b: ['Contessa', 'Assassin'], me: ['Duke', 'Captain'] },
    { coins: { b: 7 } },
  );
  game.players.b.influence[1].revealed = true;
  game.players.me.influence[1].revealed = true;
  return game;
}

/**
 * The game one move before its end, and the snapshot that ends it with B as the
 * winner: my last card goes with the coup, so there is nothing left to choose.
 */
function ending() {
  const last = lastCards();
  const over = play(last, { type: 'coup', playerId: 'b', target: 'me' });
  return { last, over };
}

/** The cues `playerId` hears when `actions` are played on `before`. */
function cuesFor(before: Game, playerId: string, ...actions: LooseAction[]) {
  return soundCues(before, play(before, ...actions), playerId);
}

describe('soundCues', () => {
  it('is silent for a first snapshot that asks nothing of me', () => {
    expect(soundCues(null, theirTurn(), 'me')).toEqual([]);
    expect(soundCues(null, table(), 'b')).toEqual([]);
    expect(
      soundCues(null, { ...lastCards(), status: 'finished' }, 'me'),
    ).toEqual([]);
    expect(soundCues(null, { ...table(), status: 'waiting' }, 'me')).toEqual(
      [],
    );
  });

  it('plays my turn or my prompt on the first snapshot, as the phone buzzes then too', () => {
    // The round's first player opens the game screen on their own turn.
    expect(soundCues(null, table(), 'me')).toEqual(['turn']);
    const asked = play(theirTurn(), { type: 'tax', playerId: 'b' });
    expect(soundCues(null, asked, 'me')).toEqual(['prompt']);
    expect(soundCues(null, asked, 'b')).toEqual([]);
  });

  it('never plays a burst for what a first snapshot already holds', () => {
    // A settled challenge, a lost card and changed coins are all on the table already.
    const challenged = play(
      theirTurn(),
      { type: 'income', playerId: 'b' },
      { type: 'tax', playerId: 'me' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(challenged.reveal).not.toBeNull();
    expect(buzzMoment(challenged, 'b')?.kind).toBe('lose');
    expect(soundCues(null, challenged, 'b')).toEqual(['prompt']);
    expect(soundCues(null, challenged, 'me')).toEqual([]);
    expect(soundCues(null, challenged, 'c')).toEqual([]);
  });

  it('agrees with the buzz on every first snapshot', () => {
    const actions: LooseAction[] = [
      { type: 'tax', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
      { type: 'pass', playerId: 'me' },
      { type: 'steal', playerId: 'me', target: 'b' },
      { type: 'pass', playerId: 'c' },
      { type: 'block', playerId: 'b', claim: 'Captain' },
      { type: 'challenge', playerId: 'me' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    ];
    let game = theirTurn();
    actions.forEach(action => {
      game = play(game, action);
      ['me', 'b', 'c'].forEach(id => {
        const kind = buzzMoment(game, id)?.kind ?? null;
        expect(soundCues(null, game, id)).toEqual(
          kind === null ? [] : [kind === 'turn' ? 'turn' : 'prompt'],
        );
      });
    });
  });

  it('is silent when nothing that can be heard changed', () => {
    const game = table();
    expect(soundCues(game, game, 'me')).toEqual([]);
    expect(soundCues(table(), table(), 'me')).toEqual([]);
    expect(soundCues(table(), { ...table(), log: ['a line'] }, 'me')).toEqual(
      [],
    );
  });

  it('plays the coin when I gain coins, and nothing else on another player turn', () => {
    expect(cuesFor(table(), 'me', { type: 'income', playerId: 'me' })).toEqual([
      'coin',
    ]);
  });

  it('plays the coin for anyone, and my turn sound when the turn reaches me', () => {
    const income: LooseAction = { type: 'income', playerId: 'b' };
    expect(cuesFor(theirTurn(), 'me', income)).toEqual(['coin', 'turn']);
    expect(cuesFor(theirTurn(), 'c', income)).toEqual(['coin']);
    expect(cuesFor(theirTurn(), 'b', income)).toEqual(['coin']);
  });

  it('plays the coin once however many players it changed for', () => {
    const before = play(
      table(),
      { type: 'steal', playerId: 'me', target: 'b' },
      { type: 'pass', playerId: 'b' },
    );
    const after = play(before, { type: 'pass', playerId: 'c' });
    expect(after.players.me.coins).not.toBe(before.players.me.coins);
    expect(after.players.b.coins).not.toBe(before.players.b.coins);
    expect(soundCues(before, after, 'c')).toEqual(['coin']);
  });

  it('plays the prompt for everyone asked to respond, not for the claimant', () => {
    const tax: LooseAction = { type: 'tax', playerId: 'b' };
    expect(cuesFor(theirTurn(), 'me', tax)).toEqual(['prompt']);
    expect(cuesFor(theirTurn(), 'c', tax)).toEqual(['prompt']);
    expect(cuesFor(theirTurn(), 'b', tax)).toEqual([]);
  });

  it('does not repeat the prompt while others answer the same claim', () => {
    const asked = play(theirTurn(), { type: 'tax', playerId: 'b' });
    expect(cuesFor(asked, 'me', { type: 'pass', playerId: 'c' })).toEqual([]);
  });

  it('plays the prompt when I must lose a card and when I must pick exchange cards', () => {
    expect(
      cuesFor(theirTurn(), 'me', { type: 'coup', playerId: 'b', target: 'me' }),
    ).toEqual(['coin', 'prompt']);

    const exchanging = play(
      table(),
      { type: 'exchange', playerId: 'me' },
      { type: 'pass', playerId: 'b' },
    );
    expect(cuesFor(exchanging, 'me', { type: 'pass', playerId: 'c' })).toEqual([
      'prompt',
    ]);
    expect(cuesFor(exchanging, 'b', { type: 'pass', playerId: 'c' })).toEqual(
      [],
    );
  });

  it('plays the card when any card is lost', () => {
    const couped = play(theirTurn(), {
      type: 'coup',
      playerId: 'b',
      target: 'c',
    });
    const lose: LooseAction = {
      type: 'loseInfluence',
      playerId: 'c',
      cardIndex: 0,
    };
    // The turn passes to me in the same snapshot.
    expect(cuesFor(couped, 'me', lose)).toEqual(['card', 'turn']);
    expect(cuesFor(couped, 'b', lose)).toEqual(['card']);
    expect(cuesFor(couped, 'c', lose)).toEqual(['card']);
  });

  it('plays the challenge when a challenge is settled', () => {
    const claimed = play(theirTurn(), { type: 'tax', playerId: 'b' });
    const challenged = play(claimed, { type: 'challenge', playerId: 'me' });
    expect(challenged.reveal?.id).toBe(1);
    expect(soundCues(claimed, challenged, 'me')).toEqual(['challenge']);
    expect(soundCues(claimed, challenged, 'c')).toEqual(['challenge']);
    // B was bluffing and must now choose a card to lose.
    expect(soundCues(claimed, challenged, 'b')).toEqual([
      'challenge',
      'prompt',
    ]);
  });

  it('does not replay a challenge that was already there', () => {
    const challenged = play(
      theirTurn(),
      { type: 'tax', playerId: 'b' },
      { type: 'challenge', playerId: 'me' },
    );
    const after = play(challenged, {
      type: 'loseInfluence',
      playerId: 'b',
      cardIndex: 0,
    });
    expect(after.reveal?.id).toBe(1);
    expect(soundCues(challenged, after, 'c')).not.toContain('challenge');
  });

  it('orders them challenge, card, coin, then turn', () => {
    const before = theirTurn();
    const after: Game = {
      ...table(),
      playerOrder: before.playerOrder,
      reveal: {
        id: 1,
        challenger: 'me',
        claimant: 'b',
        card: 'Duke',
        truthful: false,
        block: false,
      },
      revealSeq: 1,
      state: { ...before.state, currentTurnPlayer: 'me', turnNumber: 2 },
    };
    after.players.b.influence[0].revealed = true;
    after.players.c.coins = 5;
    expect(soundCues(before, after, 'me')).toEqual([
      'challenge',
      'card',
      'coin',
      'turn',
    ]);
    // Every name at most once.
    const cues = soundCues(before, after, 'me');
    expect(new Set(cues).size).toBe(cues.length);
  });

  it('plays win or lose once, when the game ends', () => {
    const { last: couped, over } = ending();
    expect(over.status).toBe('finished');
    expect(over.winner).toBe('b');
    expect(soundCues(couped, over, 'b')).toEqual(['card', 'coin', 'win']);
    expect(soundCues(couped, over, 'me')).toEqual(['card', 'coin', 'lose']);
    // Later snapshots of the finished game say nothing more.
    expect(soundCues(over, { ...over, log: [] }, 'b')).toEqual([]);
    expect(soundCues(over, { ...over, log: [] }, 'me')).toEqual([]);
  });

  it('plays neither win nor lose for someone who is not in the game', () => {
    const { last, over } = ending();
    expect(soundCues(last, over, 'stranger')).toEqual(['card', 'coin']);
  });

  it('treats another round or another game as a first snapshot', () => {
    const before = table();
    const richer = (): Game => {
      const game = theirTurn();
      game.players.me.coins = 9;
      return game;
    };
    expect(soundCues(before, { ...richer(), round: 2 }, 'me')).toEqual([]);
    expect(soundCues(before, { ...richer(), code: 'OTHER' }, 'me')).toEqual([]);
    expect(soundCues(before, { ...richer(), createdAt: 5 }, 'me')).toEqual([]);
    // Like any first snapshot, it still says so when the new round opens on my turn.
    expect(soundCues(theirTurn(), { ...table(), round: 2 }, 'me')).toEqual([
      'turn',
    ]);
  });

  it('plays turn or prompt exactly when the phone would buzz', () => {
    const actions: LooseAction[] = [
      { type: 'tax', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
      { type: 'pass', playerId: 'me' },
      { type: 'steal', playerId: 'me', target: 'b' },
      { type: 'pass', playerId: 'c' },
      { type: 'block', playerId: 'b', claim: 'Captain' },
      { type: 'challenge', playerId: 'me' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
      { type: 'income', playerId: 'c' },
      { type: 'coup', playerId: 'b', target: 'me' },
      { type: 'loseInfluence', playerId: 'me', cardIndex: 1 },
    ];
    let game = theirTurn();
    let buzzes = 0;
    actions.forEach(action => {
      const next = play(game, action);
      ['me', 'b', 'c'].forEach(id => {
        const before = buzzMoment(game, id);
        const now = buzzMoment(next, id);
        const buzz = now && now.key !== before?.key ? now.kind : null;
        const cue = soundCues(game, next, id).find(
          name => name === 'turn' || name === 'prompt',
        );
        expect(cue ?? null).toBe(
          buzz === null ? null : buzz === 'turn' ? 'turn' : 'prompt',
        );
        buzzes += buzz ? 1 : 0;
      });
      game = next;
    });
    expect(buzzes).toBeGreaterThan(8);
  });
});

describe('useGameSounds', () => {
  function Probe({ game, as = 'me' }: { game: Game | null; as?: string }) {
    useGameSounds(game, as);
    return null;
  }

  const deliver = (renderer: ReactTestRenderer, game: Game | null) =>
    act(() => {
      renderer.update(<Probe game={game} />);
    });

  const unmount = (renderer: ReactTestRenderer) =>
    act(() => {
      renderer.unmount();
    });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSound = true;
  });

  afterEach(() => {
    // Lets any handover expire, so no test inherits a snapshot from another.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('is silent when a game is opened on someone else, then plays what each new snapshot brings', () => {
    const renderer = render(<Probe game={theirTurn()} />);
    expect(played()).toEqual([]);

    const asked = play(theirTurn(), { type: 'tax', playerId: 'b' });
    deliver(renderer, asked);
    expect(played()).toEqual(['prompt']);

    deliver(renderer, play(asked, { type: 'pass', playerId: 'c' }));
    expect(played()).toEqual(['prompt']);

    deliver(
      renderer,
      play(
        asked,
        { type: 'pass', playerId: 'c' },
        { type: 'pass', playerId: 'me' },
      ),
    );
    expect(played()).toEqual(['prompt', 'coin', 'turn']);
    unmount(renderer);
  });

  it('plays only my turn when the game opens on my turn, as for the first player of a round', () => {
    const renderer = render(<Probe game={table()} />);
    expect(played()).toEqual(['turn']);
    // The same moment again says nothing more.
    deliver(renderer, { ...table(), log: ['a line'] });
    expect(played()).toEqual(['turn']);
    unmount(renderer);
  });

  it('plays only my prompt when the game opens on a claim I must answer', () => {
    const asked = play(theirTurn(), { type: 'tax', playerId: 'b' });
    const renderer = render(<Probe game={asked} />);
    expect(played()).toEqual(['prompt']);
    unmount(renderer);
  });

  it('plays nothing on opening with sound switched off', () => {
    mockSound = false;
    const renderer = render(<Probe game={table()} />);
    expect(played()).toEqual([]);
    unmount(renderer);
  });

  it('waits for the game to arrive before counting a first snapshot', () => {
    const renderer = render(<Probe game={null} />);
    deliver(renderer, theirTurn());
    expect(played()).toEqual([]);
    deliver(renderer, play(theirTurn(), { type: 'income', playerId: 'b' }));
    expect(played()).toEqual(['coin', 'turn']);
    unmount(renderer);
  });

  it('plays nothing twice when the same snapshot is rendered again', () => {
    const before = theirTurn();
    const after = play(before, { type: 'income', playerId: 'b' });
    const renderer = render(<Probe game={before} />);
    deliver(renderer, after);
    deliver(renderer, after);
    expect(played()).toEqual(['coin', 'turn']);
    unmount(renderer);
  });

  it('plays nothing while sound is switched off, and does not catch up when switched on', () => {
    mockSound = false;
    const before = theirTurn();
    const after = play(before, { type: 'income', playerId: 'b' });
    const renderer = render(<Probe game={before} />);
    deliver(renderer, after);
    expect(played()).toEqual([]);

    mockSound = true;
    deliver(renderer, after);
    expect(played()).toEqual([]);

    deliver(renderer, play(after, { type: 'income', playerId: 'me' }));
    expect(played()).toEqual(['coin']);
    unmount(renderer);
  });

  it('carries the end of the game over to the screen that replaces the game screen', () => {
    const { last, over } = ending();
    const gameScreen = render(<Probe game={last} as="b" />);
    // The game screen opened on B's own turn, which is heard like any other.
    expect(played()).toEqual(['turn']);
    (playSound as jest.Mock).mockClear();
    // The router swaps the screens in one update: one closes, the other opens.
    act(() => {
      gameScreen.update(<Probe key="over" game={over} as="b" />);
    });
    expect(played()).toEqual(['card', 'coin', 'win']);
    unmount(gameScreen);
  });

  it('plays lose for the player who did not win', () => {
    const { last, over } = ending();
    const gameScreen = render(<Probe game={last} />);
    act(() => {
      gameScreen.update(<Probe key="over" game={over} />);
    });
    expect(played()).toEqual(['card', 'coin', 'lose']);
    unmount(gameScreen);
  });

  it('is silent when a finished game is simply opened', () => {
    const renderer = render(<Probe game={ending().over} />);
    expect(played()).toEqual([]);
    unmount(renderer);
  });

  it('is silent when a finished game is opened some time after leaving the game screen', () => {
    const { last, over } = ending();
    const gameScreen = render(<Probe game={last} />);
    unmount(gameScreen);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const later = render(<Probe game={over} />);
    expect(played()).toEqual([]);
    unmount(later);
  });

  it('does not carry anything over into a game that is still being played', () => {
    const before = theirTurn();
    const first = render(<Probe game={before} />);
    act(() => {
      first.update(
        <Probe
          key="again"
          game={play(before, { type: 'income', playerId: 'b' })}
        />,
      );
    });
    // No coin for B's income: the new screen only says it opened on my turn.
    expect(played()).toEqual(['turn']);
    unmount(first);
  });
});
