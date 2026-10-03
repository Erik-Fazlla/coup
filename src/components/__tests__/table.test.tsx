import React from 'react';
import { act } from 'react-test-renderer';
import { Card, Player } from '../../engine/types';
import { colors } from '../../theme';
import { EventBanner } from '../EventBanner';
import { ExchangePicker } from '../ExchangePicker';
import { LogSheet, LOG_SHEET_ENTRIES } from '../LogSheet';
import { LoseInfluencePicker } from '../LoseInfluencePicker';
import {
  BANNER_MIN_HEIGHT,
  REGION_GAP,
  SEAT_GAP,
  SEAT_HEIGHT,
  tableLayout,
  TILE_GAP,
  TOP_BAR_HEIGHT,
} from '../tableLayout';
import { TopBar } from '../TopBar';
import {
  button,
  findButton,
  isEnabled,
  press,
  render,
  rendered,
  texts,
} from '../testUtils';

describe('tableLayout', () => {
  /** Everything stacked on the table must add up to the height it was given. */
  const used = (width: number, height: number, opponents: number) => {
    const layout = tableLayout(width, height, opponents);
    const seats =
      layout.seatRows * SEAT_HEIGHT + (layout.seatRows - 1) * SEAT_GAP;
    return (
      TOP_BAR_HEIGHT +
      seats +
      layout.bannerHeight +
      layout.bottomHeight +
      3 * REGION_GAP
    );
  };

  it('fits a 640x360 phone with five opponents in one row of seats', () => {
    // 640x360 minus the table padding of 12 per side and 8 top and bottom.
    const layout = tableLayout(616, 344, 5);
    expect(layout.seatRows).toBe(1);
    expect(layout.seatsPerRow).toBe(5);
    expect(layout.seatWidth * 5 + SEAT_GAP * 4).toBeLessThanOrEqual(616);
    expect(layout.seatWidth).toBeGreaterThanOrEqual(108);
    expect(layout.compactSeats).toBe(true);
    expect(layout.bottomHeight).toBe(128);
    expect(layout.bannerHeight).toBe(98);
    expect(layout.handAbilityLines).toBe(2);
    expect(used(616, 344, 5)).toBe(344);
  });

  it('wraps seats into two rows when one row would make them too narrow', () => {
    const layout = tableLayout(548, 344, 5);
    expect(layout.seatsPerRow).toBe(3);
    expect(layout.seatRows).toBe(2);
    expect(layout.bannerHeight).toBeGreaterThanOrEqual(BANNER_MIN_HEIGHT);
    expect(used(548, 344, 5)).toBe(344);
  });

  it('takes space from the banner first, then from the bottom row, never below one banner line', () => {
    // Narrow and short at once: side and bottom system bars on a 640x360 phone.
    const layout = tableLayout(548, 328, 5);
    expect(layout.bannerHeight).toBe(BANNER_MIN_HEIGHT);
    expect(layout.bottomHeight).toBeGreaterThanOrEqual(104);
    expect(layout.handAbilityLines).toBe(0);
    expect(used(548, 328, 5)).toBe(328);
  });

  it('keeps every action tile and seat at least 44 high and wide on the smallest phone', () => {
    [
      [616, 344],
      [548, 328],
    ].forEach(([width, height]) => {
      const layout = tableLayout(width, height, 5);
      const tileHeight = (layout.bottomHeight - 6) / 2;
      const tileWidth = (width - layout.handWidth - 8 - 3 * 6) / 4;
      expect(tileHeight).toBeGreaterThanOrEqual(44);
      expect(tileWidth).toBeGreaterThanOrEqual(44);
      expect(SEAT_HEIGHT).toBeGreaterThanOrEqual(44);
      expect(layout.seatWidth).toBeGreaterThanOrEqual(44);
    });
  });

  it('gives few opponents wide seats and a large phone a taller bottom row', () => {
    const layout = tableLayout(868, 396, 2);
    expect(layout.seatRows).toBe(1);
    expect(layout.seatWidth).toBe(220);
    expect(layout.compactSeats).toBe(false);
    expect(layout.bottomHeight).toBeGreaterThan(128);
    expect(layout.bottomHeight).toBeLessThanOrEqual(170);
  });

  it('keeps the landscape layout side by side with four action columns', () => {
    const layout = tableLayout(616, 344, 5);
    expect(layout.portrait).toBe(false);
    expect(layout.actionColumns).toBe(4);
    expect(layout.handHeight).toBe(layout.bottomHeight);
    expect(layout.controlsHeight).toBe(layout.bottomHeight);
  });
});

describe('tableLayout in portrait', () => {
  /** Top bar, seats, banner, hand and action grid stacked, with a gap between each. */
  const used = (width: number, height: number, opponents: number) => {
    const layout = tableLayout(width, height, opponents);
    const seats =
      layout.seatRows * SEAT_HEIGHT + (layout.seatRows - 1) * SEAT_GAP;
    return (
      TOP_BAR_HEIGHT +
      seats +
      layout.bannerHeight +
      layout.handHeight +
      layout.controlsHeight +
      4 * REGION_GAP
    );
  };
  /** Four rows of tiles with three gaps. */
  const tileHeight = (controls: number) => (controls - 3 * TILE_GAP) / 4;

  it('fits a 360x640 phone with five opponents without scrolling', () => {
    // 360x640 minus the table padding of 12 per side and 8 top and bottom.
    const layout = tableLayout(336, 624, 5);
    expect(layout.portrait).toBe(true);
    expect(layout.actionColumns).toBe(2);
    // Seats: three in the first row, two in the second.
    expect(layout.seatsPerRow).toBe(3);
    expect(layout.seatRows).toBe(2);
    expect(layout.seatWidth).toBe(108);
    expect(layout.seatWidth * 3 + SEAT_GAP * 2).toBeLessThanOrEqual(336);
    expect(layout.compactSeats).toBe(true);
    // 44 top bar + 118 seats + 112 banner + 100 hand + 226 actions + 4 gaps of 6 = 624.
    expect(layout.bannerHeight).toBe(112);
    expect(layout.handHeight).toBe(100);
    expect(layout.controlsHeight).toBe(226);
    expect(layout.bottomHeight).toBe(100 + REGION_GAP + 226);
    expect(layout.handAbilityLines).toBe(2);
    expect(tileHeight(layout.controlsHeight)).toBe(52);
    expect(used(336, 624, 5)).toBe(624);
  });

  it('still fits when system bars take 56 more off the height', () => {
    const layout = tableLayout(336, 568, 5);
    expect(layout.handHeight).toBe(100);
    expect(layout.controlsHeight).toBe(226);
    expect(layout.bannerHeight).toBe(56);
    expect(used(336, 568, 5)).toBe(568);
  });

  it('gives up the ability text, then tile height, before the banner line', () => {
    const tight = tableLayout(336, 520, 5);
    expect(tight.handHeight).toBeLessThan(100);
    expect(tight.handHeight).toBeGreaterThanOrEqual(76);
    expect(tight.handAbilityLines).toBe(0);
    expect(tight.controlsHeight).toBe(226);
    expect(tight.bannerHeight).toBe(BANNER_MIN_HEIGHT);
    expect(used(336, 520, 5)).toBe(520);

    const tighter = tableLayout(336, 490, 5);
    expect(tighter.handHeight).toBe(76);
    expect(tileHeight(tighter.controlsHeight)).toBeGreaterThanOrEqual(44);
    expect(tighter.controlsHeight).toBeLessThan(226);
    expect(tighter.bannerHeight).toBe(BANNER_MIN_HEIGHT);
    expect(used(336, 490, 5)).toBe(490);
  });

  it('keeps every tile, seat and hand card at least 44 high and wide', () => {
    [624, 568, 520, 490].forEach(height => {
      const layout = tableLayout(336, height, 5);
      expect(tileHeight(layout.controlsHeight)).toBeGreaterThanOrEqual(44);
      expect((336 - TILE_GAP) / 2).toBeGreaterThanOrEqual(44);
      expect(layout.seatWidth).toBeGreaterThanOrEqual(44);
      // The hand panel has 2 of border and 6 of padding on each side.
      expect(layout.handHeight - 16).toBeGreaterThanOrEqual(44);
    });
  });

  it('never lets seats drop below their minimum width, adding rows instead', () => {
    // A 320-wide phone: only two seats fit per row.
    const layout = tableLayout(296, 624, 5);
    expect(layout.seatsPerRow).toBe(2);
    expect(layout.seatRows).toBe(3);
    expect(layout.seatWidth).toBeGreaterThanOrEqual(108);
    expect(used(296, 624, 5)).toBe(624);
  });

  it('uses one row of seats for up to three opponents and grows on a tall phone', () => {
    const layout = tableLayout(388, 836, 3);
    expect(layout.seatRows).toBe(1);
    expect(layout.seatsPerRow).toBe(3);
    expect(tileHeight(layout.controlsHeight)).toBe(64);
    expect(layout.handHeight).toBe(116);
    expect(used(388, 836, 3)).toBe(836);
  });
});

describe('EventBanner', () => {
  const props = {
    primary: 'A claims Duke: Tax',
    secondary: 'A takes Income',
    error: null,
    yours: true,
    onPress: jest.fn(),
  };

  it('shows what is asked and the latest log entry, and opens the log when tapped', () => {
    const onPress = jest.fn();
    const renderer = render(<EventBanner {...props} onPress={onPress} />);
    expect(rendered(renderer)).toContain('A claims Duke: Tax');
    expect(rendered(renderer)).toContain('A takes Income');
    expect(button(renderer, 'event-banner').props.accessibilityLabel).toBe(
      'A claims Duke: Tax. A takes Income. Open the game log',
    );
    press(renderer, 'event-banner');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows an error in place of the log entry', () => {
    const renderer = render(<EventBanner {...props} error="Too late" />);
    expect(rendered(renderer)).toContain('Too late');
    expect(rendered(renderer)).not.toContain('A takes Income');
  });

  it('drops the second line, never the first, when it is squeezed to one line', () => {
    const renderer = render(<EventBanner {...props} />);
    act(() => {
      button(renderer, 'event-banner').props.onLayout({
        nativeEvent: { layout: { height: BANNER_MIN_HEIGHT } },
      });
    });
    expect(texts(renderer)).toContain('A claims Duke: Tax');
    expect(texts(renderer)).not.toContain('A takes Income');
  });

  /** The lines the banner draws, top to bottom, without the LOG tag. */
  const lines = (renderer: ReturnType<typeof render>) =>
    renderer.root
      .findAll(
        node => (node.type as unknown) === 'Text' && !!node.props.numberOfLines,
      )
      .map(node => node.props);
  const squeeze = (renderer: ReturnType<typeof render>, height: number) =>
    act(() => {
      button(renderer, 'event-banner').props.onLayout({
        nativeEvent: { layout: { height } },
      });
    });

  it('still shows an error when it is squeezed to one line', () => {
    const renderer = render(<EventBanner {...props} error="Too late" />);
    squeeze(renderer, BANNER_MIN_HEIGHT);
    expect(lines(renderer).map(line => line.children)).toEqual(['Too late']);
  });

  it('puts an error first, in the danger colour, and announces it', () => {
    const renderer = render(<EventBanner {...props} error="Too late" />);
    squeeze(renderer, 98);
    const [first, second] = lines(renderer);
    expect(first.children).toBe('Too late');
    expect(first.accessibilityLiveRegion).toBe('polite');
    expect(JSON.stringify(first.style)).toContain(colors.danger);
    // What is asked of the player is still there underneath when there is room.
    expect(second.children).toBe('A claims Duke: Tax');
    expect(JSON.stringify(second.style)).not.toContain(colors.danger);
    expect(button(renderer, 'event-banner').props.accessibilityLabel).toBe(
      'Too late. A claims Duke: Tax. Open the game log',
    );
  });

  it('draws nothing in the danger colour without an error', () => {
    const renderer = render(<EventBanner {...props} />);
    lines(renderer).forEach(line => {
      expect(JSON.stringify(line.style)).not.toContain(colors.danger);
      expect(line.accessibilityLiveRegion).toBeUndefined();
    });
  });
});

describe('LogSheet', () => {
  const log = Array.from({ length: 40 }, (_, index) => `event ${index + 1}.`);

  it('renders nothing while closed', () => {
    const renderer = render(
      <LogSheet visible={false} log={log} onClose={jest.fn()} />,
    );
    expect(renderer.toJSON()).toBeNull();
  });

  it('shows the last 30 entries, newest first, with their numbers', () => {
    const renderer = render(<LogSheet visible log={log} onClose={jest.fn()} />);
    const lines = texts(renderer).filter(
      (value): value is string =>
        typeof value === 'string' && value.startsWith('event '),
    );
    expect(lines).toHaveLength(LOG_SHEET_ENTRIES);
    expect(lines[0]).toBe('event 40.');
    expect(lines[lines.length - 1]).toBe('event 11.');
    expect(rendered(renderer)).not.toContain('event 10.');
  });

  it('says so when nothing has happened, and closes', () => {
    const onClose = jest.fn();
    const renderer = render(<LogSheet visible log={[]} onClose={onClose} />);
    expect(rendered(renderer)).toContain('Nothing has happened yet.');
    act(() => {
      renderer.root.findByProps({ label: 'Close' }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('TopBar', () => {
  const bar = (
    connected: boolean,
    onLeave = jest.fn(),
    onRules = jest.fn(),
    compact = false,
  ) =>
    render(
      <TopBar
        turn={7}
        deck={9}
        code="ABCDE"
        connected={connected}
        compact={compact}
        onRules={onRules}
        onLeave={onLeave}
      />,
    );

  it('shows the turn, the deck count and the join code', () => {
    const labels = bar(true)
      .root.findAll(node => typeof node.type === 'string')
      .map(node => node.props.accessibilityLabel);
    expect(labels).toEqual(
      expect.arrayContaining(['Turn 7', 'Deck 9', 'Code ABCDE']),
    );
  });

  it('warns while disconnected and only then', () => {
    expect(rendered(bar(true))).not.toContain('Reconnecting');
    expect(rendered(bar(false))).toContain('Reconnecting');
  });

  it('has a Leave button and a Rules button', () => {
    const onLeave = jest.fn();
    const onRules = jest.fn();
    const renderer = bar(true, onLeave, onRules);
    press(renderer, 'leave');
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onRules).not.toHaveBeenCalled();
    press(renderer, 'rules');
    expect(onRules).toHaveBeenCalledTimes(1);
    expect(button(renderer, 'rules').props.accessibilityLabel).toBe('Rules');
  });

  it('keeps both buttons, every stat and their spoken labels on a narrow bar', () => {
    const renderer = bar(true, jest.fn(), jest.fn(), true);
    expect(findButton(renderer, 'rules')).toBeDefined();
    expect(findButton(renderer, 'leave')).toBeDefined();
    const labels = renderer.root
      .findAll(node => typeof node.type === 'string')
      .map(node => node.props.accessibilityLabel);
    expect(labels).toEqual(
      expect.arrayContaining(['Turn 7', 'Deck 9', 'Code ABCDE']),
    );
    // No room for the brand on a narrow bar.
    expect(texts(renderer)).not.toContain('COUP');
  });

  it('shows the connection warning in place of the stats on a narrow bar', () => {
    const renderer = bar(false, jest.fn(), jest.fn(), true);
    expect(rendered(renderer)).toContain('Reconnecting');
    expect(rendered(renderer)).not.toContain('Turn 7');
    expect(findButton(renderer, 'rules')).toBeDefined();
    expect(findButton(renderer, 'leave')).toBeDefined();
  });
});

describe('LoseInfluencePicker', () => {
  const player: Player = {
    name: 'ME',
    coins: 2,
    influence: [
      { card: 'Duke', revealed: true },
      { card: 'Captain', revealed: false },
    ],
    eliminatedAt: null,
  };

  it('offers only the cards still hidden and reports the index picked', () => {
    const onPick = jest.fn();
    const renderer = render(
      <LoseInfluencePicker player={player} disabled={false} onPick={onPick} />,
    );
    expect(findButton(renderer, 'lose-card-0')).toBeUndefined();
    press(renderer, 'lose-card-1');
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it('cannot be used while offline or busy', () => {
    const onPick = jest.fn();
    const renderer = render(
      <LoseInfluencePicker player={player} disabled onPick={onPick} />,
    );
    expect(isEnabled(renderer, 'lose-card-1')).toBe(false);
    press(renderer, 'lose-card-1');
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('ExchangePicker', () => {
  const options: Card[] = ['Duke', 'Captain', 'Contessa', 'Assassin'];
  const picker = (onConfirm = jest.fn(), disabled = false) =>
    render(
      <ExchangePicker
        options={options}
        keepCount={2}
        disabled={disabled}
        onConfirm={onConfirm}
      />,
    );

  it('confirms only once exactly the right number of cards is chosen', () => {
    const onConfirm = jest.fn();
    const renderer = picker(onConfirm);
    expect(isEnabled(renderer, 'exchange-confirm')).toBe(false);
    press(renderer, 'exchange-card-3');
    expect(isEnabled(renderer, 'exchange-confirm')).toBe(false);
    press(renderer, 'exchange-card-1');
    expect(isEnabled(renderer, 'exchange-confirm')).toBe(true);
    press(renderer, 'exchange-confirm');
    expect(onConfirm).toHaveBeenCalledWith([3, 1]);
  });

  it('ignores a third card and lets a chosen card be put back', () => {
    const onConfirm = jest.fn();
    const renderer = picker(onConfirm);
    press(renderer, 'exchange-card-0');
    press(renderer, 'exchange-card-1');
    press(renderer, 'exchange-card-2');
    press(renderer, 'exchange-card-0');
    press(renderer, 'exchange-card-2');
    expect(
      button(renderer, 'exchange-card-2').props.accessibilityState.selected,
    ).toBe(true);
    press(renderer, 'exchange-confirm');
    expect(onConfirm).toHaveBeenCalledWith([1, 2]);
  });

  it('cannot confirm while offline or busy', () => {
    const onConfirm = jest.fn();
    const renderer = picker(onConfirm, true);
    press(renderer, 'exchange-card-0');
    press(renderer, 'exchange-card-1');
    expect(isEnabled(renderer, 'exchange-confirm')).toBe(false);
  });
});
