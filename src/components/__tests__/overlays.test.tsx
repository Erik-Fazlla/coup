import React from 'react';
import { BackHandler, ScrollView, StyleSheet } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import {
  ACTION_DETAIL,
  ACTION_LABEL,
  CHARACTER_INFO,
  RULE_NOTES,
} from '../../engine/describe';
import {
  ACTION_CLAIM,
  ACTION_COST,
  BLOCK_CLAIMS,
  FORCED_COUP_COINS,
} from '../../engine/rules';
import { makeGame, play } from '../../engine/testHelpers';
import { ActionType, CARDS, Game, Player } from '../../engine/types';
import { ExchangePicker } from '../ExchangePicker';
import { OnlineDot } from '../OnlineDot';
import { ResponseBar } from '../ResponseBar';
import { RevealOverlay } from '../RevealOverlay';
import { RulesSheet } from '../RulesSheet';
import { Scoreboard } from '../Scoreboard';
import { Seat } from '../Seat';
import { findButton, press, render, rendered, texts } from '../testUtils';

const ALL_ACTIONS = Object.keys(ACTION_COST) as ActionType[];

/** The view on screen with this testID. */
const host = (renderer: ReactTestRenderer, testID: string) =>
  renderer.root.find(
    node => typeof node.type === 'string' && node.props.testID === testID,
  );

describe('RulesSheet', () => {
  const open = (onClose = jest.fn()) =>
    render(<RulesSheet visible onClose={onClose} />);

  it('renders nothing while closed', () => {
    expect(
      render(<RulesSheet visible={false} onClose={jest.fn()} />).toJSON(),
    ).toBeNull();
  });

  it('has a row for every action the engine knows', () => {
    const renderer = open();
    ALL_ACTIONS.forEach(action => {
      const row = host(renderer, `rule-${action}`);
      expect(row.props.accessibilityLabel).toContain(ACTION_LABEL[action]);
    });
    expect(
      renderer.root.findAll(
        node =>
          typeof node.type === 'string' &&
          String(node.props.testID ?? '').startsWith('rule-'),
      ),
    ).toHaveLength(ALL_ACTIONS.length);
  });

  it('reads cost, effect, claim and blockers from the engine tables', () => {
    const renderer = open();
    ALL_ACTIONS.forEach(action => {
      const label = host(renderer, `rule-${action}`).props
        .accessibilityLabel as string;
      const claim = ACTION_CLAIM[action];
      const blockers = BLOCK_CLAIMS[action];
      expect(label.split(', ')).toEqual(
        expect.arrayContaining([
          ACTION_COST[action] > 0 ? `${ACTION_COST[action]} coins` : 'Free',
          claim ? `Claims ${claim}` : 'No claim',
          blockers.length > 0
            ? `Blocked by ${blockers.join(' or ')}`
            : 'Cannot be blocked',
        ]),
      );
      expect(label).toContain(ACTION_DETAIL[action]);
    });
  });

  it('names exactly the blockers in BLOCK_CLAIMS for each action', () => {
    const renderer = open();
    ALL_ACTIONS.forEach(action => {
      const row = host(renderer, `rule-${action}`);
      const blockLine = row
        .findAll(node => (node.type as unknown) === 'Text')
        .map(node => node.props.children)
        .find(
          (text): text is string =>
            typeof text === 'string' &&
            (text.startsWith('Blocked by') || text === 'Cannot be blocked'),
        )!;
      const named = CARDS.filter(card => blockLine.includes(card));
      expect(named).toEqual(
        CARDS.filter(card => BLOCK_CLAIMS[action].includes(card)),
      );
    });
  });

  it('shows all five characters with their abilities', () => {
    const renderer = open();
    CARDS.forEach(card => {
      expect(host(renderer, `character-${card}`).props.accessibilityLabel).toBe(
        `${card}: ${CHARACTER_INFO[card].ability}`,
      );
    });
  });

  it('explains challenges, blocks, losing influence and the forced Coup', () => {
    const renderer = open();
    RULE_NOTES.forEach(note => {
      expect(texts(renderer)).toContain(note.title.toUpperCase());
      expect(texts(renderer)).toContain(note.text);
    });
    expect(rendered(renderer)).toContain(
      `With ${FORCED_COUP_COINS} or more coins you must Coup`,
    );
  });

  it('closes with its button and with the hardware back key', () => {
    let back: (() => unknown) | undefined;
    const listen = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        back = handler as unknown as () => unknown;
        return { remove: jest.fn() };
      });
    const onClose = jest.fn();
    const renderer = open(onClose);
    act(() => {
      renderer.root.findByProps({ label: 'Close' }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(back?.()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
    listen.mockRestore();
  });

  it('scrolls', () => {
    const renderer = open();
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(1);
  });
});

describe('RevealOverlay', () => {
  it('shows the headline and who loses a card, and is dismissed by a tap', () => {
    const onDismiss = jest.fn();
    const renderer = render(
      <RevealOverlay
        card="Duke"
        truthful={false}
        headline="Maria was bluffing — no Duke"
        consequence="Maria loses a card"
        onDismiss={onDismiss}
      />,
    );
    expect(texts(renderer)).toContain('Maria was bluffing — no Duke');
    expect(texts(renderer)).toContain('Maria loses a card');
    expect(texts(renderer)).toContain('BLUFF');
    press(renderer, 'reveal-overlay');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  const overlay = (
    props: Partial<React.ComponentProps<typeof RevealOverlay>>,
  ) =>
    render(
      <RevealOverlay
        card="Duke"
        truthful={false}
        headline="Maria was bluffing — no Duke"
        consequence="Maria loses a card"
        onDismiss={jest.fn()}
        {...props}
      />,
    );
  const flat = (style: unknown) => StyleSheet.flatten(style as never) as any;

  it('lets every touch outside the card through to the table', () => {
    const renderer = overlay({});
    const root = renderer.toJSON() as any;
    // The container is never a touch target itself, and the dimmed layer takes no touches at all.
    expect(root.props.pointerEvents).toBe('box-none');
    expect(host(renderer, 'reveal-scrim').props.pointerEvents).toBe('none');
    expect(host(renderer, 'reveal-region').props.pointerEvents).toBe(
      'box-none',
    );
    // The card is the only thing that answers a tap.
    const touchable = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        (node.props.onClick !== undefined ||
          node.props.onStartShouldSetResponder !== undefined ||
          node.props.onResponderGrant !== undefined),
    );
    expect(touchable.map(node => node.props.testID)).toEqual([
      'reveal-overlay',
    ]);
  });

  it('keeps the card above the hand and the actions', () => {
    const region = host(overlay({ bottomInset: 134 }), 'reveal-region');
    expect(flat(region.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      bottom: 134,
    });
    // The dimming still covers the whole table.
    const scrim = host(overlay({ bottomInset: 134 }), 'reveal-scrim');
    expect(flat(scrim.props.style)).toMatchObject({ top: 0, bottom: 0 });
  });

  it('never grows past the space it is given', () => {
    [false, true].forEach(compact => {
      const card = findButton(overlay({ compact }), 'reveal-overlay')!;
      // Pressable hands its style to the view underneath.
      const view = host(overlay({ compact }), 'reveal-overlay');
      expect(card).toBeDefined();
      expect(flat(view.props.style)).toMatchObject({
        maxHeight: '100%',
        overflow: 'hidden',
      });
    });
  });

  it('says the same in the short layout', () => {
    const renderer = overlay({ compact: true });
    expect(texts(renderer)).toContain('Maria was bluffing — no Duke');
    expect(texts(renderer)).toContain('Maria loses a card');
    expect(texts(renderer)).toContain('BLUFF');
  });

  it('marks a true claim as true', () => {
    const renderer = render(
      <RevealOverlay
        card="Captain"
        truthful
        headline="Maria had the Captain"
        consequence="Erik loses a card"
        onDismiss={jest.fn()}
      />,
    );
    expect(texts(renderer)).toContain('TRUE CLAIM');
    expect(texts(renderer)).not.toContain('BLUFF');
  });
});

describe('Scoreboard', () => {
  const game = (): Game => ({
    ...makeGame({
      a: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
      c: ['Ambassador', 'Duke'],
    }),
    round: 3,
    scores: { b: 2 },
  });

  it('lists every player with their wins, most first, and the round', () => {
    const renderer = render(<Scoreboard game={game()} playerId="a" />);
    expect(rendered(renderer)).toContain('ROUND ');
    expect(
      renderer.root
        .findAll(
          node =>
            typeof node.type === 'string' &&
            String(node.props.testID ?? '').startsWith('score-'),
        )
        .map(node => node.props.accessibilityLabel),
    ).toEqual(['B: 2 wins', 'A (you): 0 wins', 'C: 0 wins']);
  });

  it('says "1 win" for one', () => {
    const renderer = render(
      <Scoreboard game={{ ...game(), scores: { c: 1 } }} playerId="a" />,
    );
    expect(texts(renderer)).toContain('1 win');
  });

  it('keeps a long name on one line', () => {
    const long = game();
    long.players.b.name = 'Αλεξανδρόπουλος1';
    const renderer = render(<Scoreboard game={long} playerId="a" />);
    const name = renderer.root.find(
      node =>
        (node.type as unknown) === 'Text' &&
        node.props.children === 'Αλεξανδρόπουλος1',
    );
    expect(name.props.numberOfLines).toBe(1);
  });
});

describe('Seat online dot', () => {
  const player: Player = {
    name: 'OTHER',
    coins: 3,
    influence: [
      { card: 'Duke', revealed: false },
      { card: 'Duke', revealed: false },
    ],
    eliminatedAt: null,
  };
  const label = (renderer: ReactTestRenderer) =>
    host(renderer, 'seat').props.accessibilityLabel as string;

  it('shows a green dot and says online', () => {
    const renderer = render(
      <Seat player={player} isTurn={false} online testID="seat" />,
    );
    expect(renderer.root.findByType(OnlineDot).props.online).toBe(true);
    expect(label(renderer)).toBe('OTHER, 3 coins, 2 hidden cards, online');
  });

  it('shows a grey dot and says offline', () => {
    const renderer = render(
      <Seat player={player} isTurn online={false} testID="seat" />,
    );
    expect(renderer.root.findByType(OnlineDot).props.online).toBe(false);
    expect(label(renderer)).toBe(
      'OTHER, 3 coins, 2 hidden cards, their turn, offline',
    );
  });

  it('shows no dot and says nothing when presence is unknown', () => {
    [null, undefined].forEach(online => {
      const renderer = render(
        <Seat player={player} isTurn={false} online={online} testID="seat" />,
      );
      expect(renderer.root.findAllByType(OnlineDot)).toHaveLength(0);
      expect(label(renderer)).toBe('OTHER, 3 coins, 2 hidden cards');
    });
  });

  it('tells a targeting player whether the target is online', () => {
    const renderer = render(
      <Seat
        player={player}
        isTurn={false}
        online={false}
        target={{ verb: 'Steal', disabled: false, onPress: jest.fn() }}
        testID="seat"
      />,
    );
    expect(findButton(renderer, 'seat')!.props.accessibilityLabel).toBe(
      'Steal: OTHER, 3 coins, 2 hidden cards, offline. Tap to target',
    );
  });
});

describe('ResponseBar columns', () => {
  /** A steal aimed at `me`: Pass, Challenge, Block as Captain, Block as Ambassador. */
  const stolenFrom = () =>
    play(
      makeGame({ other: ['Contessa', 'Assassin'], me: ['Duke', 'Captain'] }),
      { type: 'steal', playerId: 'other', target: 'me' },
    );

  const rows = (columns?: number) => {
    const renderer = render(
      <ResponseBar
        game={stolenFrom()}
        playerId="me"
        disabled={false}
        columns={columns}
        onAction={jest.fn()}
      />,
    );
    const bar = renderer.toJSON() as { children: { children: unknown[] }[] };
    return bar.children.map(row => row.children.length);
  };

  it('keeps every tile in one row by default', () => {
    expect(rows()).toEqual([4]);
  });

  it('wraps four tiles into two rows of two in portrait', () => {
    expect(rows(2)).toEqual([2, 2]);
  });

  it('does not wrap when the tiles already fit', () => {
    const game = play(
      makeGame({ other: ['Contessa', 'Assassin'], me: ['Duke', 'Captain'] }),
      { type: 'tax', playerId: 'other' },
    );
    const renderer = render(
      <ResponseBar
        game={game}
        playerId="me"
        disabled={false}
        columns={2}
        onAction={jest.fn()}
      />,
    );
    const bar = renderer.toJSON() as { children: { children: unknown[] }[] };
    expect(bar.children.map(row => row.children.length)).toEqual([2]);
  });
});

describe('ExchangePicker stacked', () => {
  it('still confirms the chosen cards when Confirm sits under the cards', () => {
    const onConfirm = jest.fn();
    const renderer = render(
      <ExchangePicker
        options={['Duke', 'Captain', 'Contessa', 'Assassin']}
        keepCount={2}
        disabled={false}
        stacked
        onConfirm={onConfirm}
      />,
    );
    press(renderer, 'exchange-card-0');
    press(renderer, 'exchange-card-3');
    press(renderer, 'exchange-confirm');
    expect(onConfirm).toHaveBeenCalledWith([0, 3]);
  });
});
