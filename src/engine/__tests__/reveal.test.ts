import { newGame, rematch, startGame } from '../lobby';
import { identityRng, makeGame, play } from '../testHelpers';

const three = () =>
  makeGame({
    a: ['Duke', 'Captain'],
    b: ['Contessa', 'Assassin'],
    c: ['Ambassador', 'Duke'],
  });

describe('challenge reveal record', () => {
  it('is empty before any challenge', () => {
    expect(newGame('p1', 'P1', 'ABCDE', 0).reveal).toBeNull();
    expect(newGame('p1', 'P1', 'ABCDE', 0).revealSeq).toBe(0);
    const declared = play(three(), { type: 'tax', playerId: 'a' });
    expect(declared.reveal).toBeNull();
    expect(declared.revealSeq).toBe(0);
  });

  it('records a challenged action whose claim was true', () => {
    const game = play(
      three(),
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(game.reveal).toEqual({
      id: 1,
      challenger: 'b',
      claimant: 'a',
      card: 'Duke',
      truthful: true,
      block: false,
    });
  });

  it('records a challenged action that was a bluff', () => {
    const game = play(
      three(),
      { type: 'steal', playerId: 'a', target: 'b' },
      { type: 'pass', playerId: 'c' },
      { type: 'block', playerId: 'b', claim: 'Captain' },
      { type: 'pass', playerId: 'c' },
      { type: 'pass', playerId: 'a' },
      { type: 'tax', playerId: 'b' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(game.reveal).toEqual({
      id: 1,
      challenger: 'c',
      claimant: 'b',
      card: 'Duke',
      truthful: false,
      block: false,
    });
  });

  it('records a challenged block whose claim was true', () => {
    const game = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'c', claim: 'Duke' },
      { type: 'challenge', playerId: 'a' },
    );
    expect(game.reveal).toEqual({
      id: 1,
      challenger: 'a',
      claimant: 'c',
      card: 'Duke',
      truthful: true,
      block: true,
    });
  });

  it('records a challenged block that was a bluff', () => {
    const game = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(game.reveal).toEqual({
      id: 1,
      challenger: 'c',
      claimant: 'b',
      card: 'Duke',
      truthful: false,
      block: true,
    });
  });

  it('stays set until the next reveal, which gets the next id', () => {
    const first = play(
      three(),
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    );
    expect(first.state.currentTurnPlayer).toBe('b');
    const later = play(
      first,
      { type: 'income', playerId: 'b' },
      { type: 'income', playerId: 'c' },
    );
    expect(later.reveal).toEqual(first.reveal);
    expect(later.reveal?.id).toBe(1);

    const second = play(
      later,
      { type: 'exchange', playerId: 'a' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(second.reveal).toMatchObject({
      id: 2,
      challenger: 'c',
      claimant: 'a',
      card: 'Ambassador',
      block: false,
    });
    expect(second.revealSeq).toBe(2);
  });

  it('is cleared by a rematch while the ids keep counting up', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'] },
      { deck: ['Ambassador', 'Assassin', 'Captain'] },
    );
    const end = play(
      start,
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(end.status).toBe('finished');
    expect(end.reveal?.id).toBe(1);

    const lobby = rematch(end, 'a', identityRng);
    expect(lobby.reveal).toBeNull();
    expect(lobby.revealSeq).toBe(1);

    const second = startGame(lobby, 'a', identityRng);
    expect(second.reveal).toBeNull();
    // Unshuffled deal: a holds Duke, Duke. Round 2 starts with b, who takes Income first.
    const challenged = play(
      second,
      { type: 'income', playerId: 'b' },
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(challenged.reveal).toMatchObject({ id: 2, truthful: true });
  });
});
