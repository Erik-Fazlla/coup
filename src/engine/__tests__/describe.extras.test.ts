import {
  ACTION_DETAIL,
  ACTION_LABEL,
  ACTION_ORDER,
  actionRules,
  revealLoserLine,
  RULE_NOTES,
  shareMessage,
  waitingNames,
  waitingOn,
} from '../describe';
import {
  ACTION_CLAIM,
  ACTION_COST,
  BLOCK_CLAIMS,
  FORCED_COUP_COINS,
} from '../rules';
import { makeGame, play } from '../testHelpers';
import { ActionType } from '../types';

const ALL_ACTIONS = Object.keys(ACTION_COST) as ActionType[];

const three = () =>
  makeGame(
    {
      a: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
      c: ['Ambassador', 'Duke'],
    },
    { coins: { a: 7 } },
  );

describe('waitingOn', () => {
  it('is the player whose turn it is during the action phase', () => {
    expect(waitingOn(three())).toEqual(['a']);
    expect(waitingNames(three())).toBe('A');
  });

  it('is everyone who has not responded yet', () => {
    const asked = play(three(), { type: 'tax', playerId: 'a' });
    expect(waitingOn(asked)).toEqual(['b', 'c']);
    expect(waitingNames(asked)).toBe('B, C');

    const onePassed = play(asked, { type: 'pass', playerId: 'b' });
    expect(waitingOn(onePassed)).toEqual(['c']);
  });

  it('is everyone who may still challenge a block', () => {
    const blocked = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
    );
    expect(blocked.state.phase).toBe('awaitingBlockResponses');
    expect(waitingOn(blocked)).toEqual(['a', 'c']);
  });

  it('is the player who must lose a card', () => {
    const couped = play(three(), { type: 'coup', playerId: 'a', target: 'c' });
    expect(couped.state.phase).toBe('loseInfluence');
    expect(waitingOn(couped)).toEqual(['c']);
  });

  it('is the player choosing exchange cards', () => {
    const exchanging = play(
      three(),
      { type: 'exchange', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(exchanging.state.phase).toBe('exchange');
    expect(waitingOn(exchanging)).toEqual(['a']);
  });

  it('is nobody when the game is not being played', () => {
    expect(waitingOn({ ...three(), status: 'waiting' })).toEqual([]);
    expect(waitingOn({ ...three(), status: 'finished' })).toEqual([]);
    expect(waitingNames({ ...three(), status: 'finished' })).toBe('');
  });
});

describe('revealLoserLine', () => {
  it('is empty when there has been no challenge', () => {
    expect(revealLoserLine(three())).toBe('');
  });

  it('names the challenger when the claim was true', () => {
    const game = play(
      three(),
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(game.reveal?.truthful).toBe(true);
    expect(revealLoserLine(game)).toBe('B loses a card');
  });

  it('names the claimant when it was a bluff', () => {
    const game = play(
      three(),
      { type: 'exchange', playerId: 'a' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(game.reveal?.truthful).toBe(false);
    expect(revealLoserLine(game)).toBe('A loses a card');
  });
});

describe('shareMessage', () => {
  it('is plain text carrying the join code', () => {
    expect(shareMessage('MR93W')).toBe('Join my Coup game — code MR93W');
  });
});

describe('actionRules', () => {
  it('has exactly one row per action', () => {
    expect([...ACTION_ORDER].sort()).toEqual([...ALL_ACTIONS].sort());
    expect(actionRules().map(rule => rule.action)).toEqual(ACTION_ORDER);
  });

  it('reads every column from the tables the engine plays by', () => {
    actionRules().forEach(rule => {
      expect(rule.label).toBe(ACTION_LABEL[rule.action]);
      expect(rule.effect).toBe(ACTION_DETAIL[rule.action]);
      expect(rule.claim).toBe(ACTION_CLAIM[rule.action]);
      expect(rule.blockedBy).toEqual(BLOCK_CLAIMS[rule.action]);
      expect(rule.cost).toBe(
        ACTION_COST[rule.action] > 0
          ? `${ACTION_COST[rule.action]} coins`
          : 'Free',
      );
    });
  });
});

describe('RULE_NOTES', () => {
  it('covers the deck, challenges, blocks, losing influence and the forced Coup', () => {
    expect(RULE_NOTES.map(note => note.title)).toEqual([
      'Players and deck',
      'Challenges',
      'Blocks',
      'Losing influence',
      'Forced Coup',
    ]);
  });

  it('states the player limits and both deck sizes', () => {
    expect(RULE_NOTES[0].text).toBe(
      '2 to 10 players. Up to 6 play with 3 of each character; from 7 there are 4 of each. With 10 players every card is dealt, so the deck starts empty.',
    );
  });

  it('takes the forced Coup numbers from the engine', () => {
    const forced = RULE_NOTES.find(note => note.title === 'Forced Coup')!;
    expect(forced.text).toContain(`${FORCED_COUP_COINS} or more coins`);
    expect(forced.text).toContain(`costs ${ACTION_COST.coup} coins`);
  });
});
