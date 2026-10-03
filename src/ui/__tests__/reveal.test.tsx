import React from 'react';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { render } from '../../components/testUtils';
import { makeGame, play } from '../../engine/testHelpers';
import { Game, Reveal } from '../../engine/types';
import { REVEAL_MS, seenAtOpen, unseenReveal, useRevealOnce } from '../reveal';

const table = () =>
  makeGame({ me: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] });

/** B challenges my Tax and is wrong: reveal 1. */
const challenged = () =>
  play(
    table(),
    { type: 'tax', playerId: 'me' },
    { type: 'challenge', playerId: 'b' },
  );

const withReveal = (id: number): Game => ({
  ...table(),
  revealSeq: id,
  reveal: {
    id,
    challenger: 'b',
    claimant: 'me',
    card: 'Duke',
    truthful: true,
    block: false,
  },
});

describe('seenAtOpen and unseenReveal', () => {
  it('treats the reveal already in the game as seen when it is opened', () => {
    const game = challenged();
    expect(game.reveal?.id).toBe(1);
    expect(seenAtOpen(game)).toBe(1);
    expect(unseenReveal(game, seenAtOpen(game))).toBeNull();
  });

  it('remembers ids used in earlier rounds even when no reveal is left', () => {
    expect(seenAtOpen({ ...table(), revealSeq: 5, reveal: null })).toBe(5);
  });

  it('offers a reveal with a higher id, once', () => {
    expect(unseenReveal(withReveal(2), 1)?.id).toBe(2);
    expect(unseenReveal(withReveal(2), 2)).toBeNull();
    expect(unseenReveal(table(), 0)).toBeNull();
  });
});

describe('useRevealOnce', () => {
  let current: { reveal: Reveal | null; dismiss: () => void };

  function Probe({ game }: { game: Game | null }) {
    current = useRevealOnce(game);
    return null;
  }

  const deliver = (renderer: ReactTestRenderer, game: Game | null) =>
    act(() => {
      renderer.update(<Probe game={game} />);
    });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not replay the reveal that was already there when the game was opened', () => {
    render(<Probe game={challenged()} />);
    expect(current.reveal).toBeNull();
  });

  it('shows a new reveal, then hides it after its duration', () => {
    const renderer = render(<Probe game={table()} />);
    expect(current.reveal).toBeNull();

    deliver(renderer, challenged());
    expect(current.reveal?.id).toBe(1);

    act(() => {
      jest.advanceTimersByTime(REVEAL_MS - 1);
    });
    expect(current.reveal?.id).toBe(1);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(current.reveal).toBeNull();
  });

  it('keeps its own clock when more snapshots arrive, and never shows the same reveal twice', () => {
    const renderer = render(<Probe game={table()} />);
    deliver(renderer, withReveal(1));

    act(() => {
      jest.advanceTimersByTime(REVEAL_MS / 2);
    });
    // The loser picks a card: a new snapshot carrying the same reveal.
    deliver(renderer, { ...withReveal(1), log: ['B loses a card'] });
    expect(current.reveal?.id).toBe(1);

    act(() => {
      jest.advanceTimersByTime(REVEAL_MS / 2);
    });
    expect(current.reveal).toBeNull();

    deliver(renderer, { ...withReveal(1), log: ['one more thing'] });
    expect(current.reveal).toBeNull();
  });

  it('can be dismissed early', () => {
    const renderer = render(<Probe game={table()} />);
    deliver(renderer, withReveal(1));
    act(() => current.dismiss());
    expect(current.reveal).toBeNull();
    act(() => {
      jest.advanceTimersByTime(REVEAL_MS * 2);
    });
    expect(current.reveal).toBeNull();
  });

  it('shows the next reveal after the first', () => {
    const renderer = render(<Probe game={table()} />);
    deliver(renderer, withReveal(1));
    act(() => {
      jest.advanceTimersByTime(REVEAL_MS);
    });
    deliver(renderer, withReveal(2));
    expect(current.reveal?.id).toBe(2);
  });

  it('waits for the game before deciding what has been seen', () => {
    const renderer = render(<Probe game={null} />);
    deliver(renderer, withReveal(3));
    expect(current.reveal).toBeNull();
    deliver(renderer, withReveal(4));
    expect(current.reveal?.id).toBe(4);
  });
});
