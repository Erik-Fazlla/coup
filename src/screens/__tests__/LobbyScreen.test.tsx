import React from 'react';
import { Alert, Dimensions, Share } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { OnlineDot } from '../../components/OnlineDot';
import { Scoreboard } from '../../components/Scoreboard';
import {
  findButton,
  isEnabled,
  press,
  render,
  rendered,
  texts,
} from '../../components/testUtils';
import { makeGame } from '../../engine/testHelpers';
import { Game } from '../../engine/types';
import { LobbyScreen } from '../LobbyScreen';

const mockKick = jest.fn();
const mockLeave = jest.fn();
const mockStart = jest.fn();
let mockPlayerId = 'host';
let mockGameValue: {
  game: Game | null;
  connected: boolean;
  busy: boolean;
  error: string | null;
  online: Record<string, true> | null;
  startGame: jest.Mock;
  leave: jest.Mock;
  kick: jest.Mock;
};

jest.mock('../../context/GameContext', () => ({
  useGame: () => mockGameValue,
}));
jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({ playerId: mockPlayerId }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/** A lobby of three; `host` created it. */
const lobby = (): Game => ({
  ...makeGame({ host: [], maria: [], nikos: [] }),
  status: 'waiting',
  code: 'MR93W',
});

function mount(
  as: string,
  overrides: Partial<typeof mockGameValue> = {},
): ReactTestRenderer {
  mockPlayerId = as;
  mockGameValue = {
    game: lobby(),
    connected: true,
    busy: false,
    error: null,
    online: {},
    startGame: mockStart,
    leave: mockLeave,
    kick: mockKick,
    ...overrides,
  };
  return render(<LobbyScreen />);
}

const host = (renderer: ReactTestRenderer, testID: string) =>
  renderer.root.find(
    node => typeof node.type === 'string' && node.props.testID === testID,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LobbyScreen share', () => {
  it('shares the join code as plain text', () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const renderer = mount('maria');
    press(renderer, 'share');
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      message: 'Join my Coup game — code MR93W',
    });
  });

  it('stays quiet when the share sheet is dismissed or fails', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('dismissed'));
    const renderer = mount('maria');
    await act(async () => {
      findButton(renderer, 'share')!.props.onPress();
    });
    expect(rendered(renderer)).not.toContain('dismissed');
  });

  it('stays quiet when sharing cannot even start', () => {
    jest.spyOn(Share, 'share').mockImplementation(() => {
      throw new Error('no share sheet');
    });
    const renderer = mount('maria');
    expect(() => press(renderer, 'share')).not.toThrow();
  });
});

describe('LobbyScreen kick', () => {
  it('gives the host a remove control for every other player, not for themself', () => {
    const renderer = mount('host');
    expect(findButton(renderer, 'kick-maria')).toBeDefined();
    expect(findButton(renderer, 'kick-nikos')).toBeDefined();
    expect(findButton(renderer, 'kick-host')).toBeUndefined();
    expect(findButton(renderer, 'kick-maria')!.props.accessibilityLabel).toBe(
      'Remove MARIA',
    );
  });

  it('shows no remove control to anyone else', () => {
    const renderer = mount('maria');
    ['host', 'maria', 'nikos'].forEach(id =>
      expect(findButton(renderer, `kick-${id}`)).toBeUndefined(),
    );
    expect(rendered(renderer)).not.toContain('Remove');
  });

  it('asks first, naming the player, and removes only on confirmation', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const renderer = mount('host');
    press(renderer, 'kick-nikos');
    expect(mockKick).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Remove NIKOS?');

    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find(option => option.text === 'Cancel')?.onPress?.();
    expect(mockKick).not.toHaveBeenCalled();
    buttons.find(option => option.text === 'Remove')?.onPress?.();
    expect(mockKick).toHaveBeenCalledTimes(1);
    expect(mockKick).toHaveBeenCalledWith('nikos');
  });

  it('cannot remove anyone while offline', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const renderer = mount('host', { connected: false });
    expect(isEnabled(renderer, 'kick-maria')).toBe(false);
    press(renderer, 'kick-maria');
    expect(alert).not.toHaveBeenCalled();
  });

  it('gives the remove control a 44 point touch target', () => {
    const renderer = mount('host');
    expect(host(renderer, 'kick-maria').props.style).toMatchObject({
      minWidth: 44,
      minHeight: 44,
    });
  });
});

describe('LobbyScreen online dots', () => {
  const dots = (renderer: ReactTestRenderer) =>
    renderer.root.findAllByType(OnlineDot).map(dot => dot.props.online);
  const names = (renderer: ReactTestRenderer) =>
    ['host', 'maria', 'nikos'].map(
      id =>
        // The first text in the row is the name; a host also sees "Remove" after it.
        host(renderer, `player-${id}`).findAll(
          node => (node.type as unknown) === 'Text',
        )[0].props.accessibilityLabel,
    );

  it('shows who is connected and who is not, in the label too', () => {
    const renderer = mount('host', { online: { host: true, maria: true } });
    expect(dots(renderer)).toEqual([true, true, false]);
    expect(names(renderer)).toEqual([
      'HOST (host) (you), online',
      'MARIA, online',
      'NIKOS, offline',
    ]);
  });

  it('shows no dots when presence cannot be read', () => {
    const renderer = mount('host', { online: null });
    expect(dots(renderer)).toEqual([]);
    expect(names(renderer)).toEqual(['HOST (host) (you)', 'MARIA', 'NIKOS']);
  });

  it('shows no dots until the list includes this phone', () => {
    expect(dots(mount('host', { online: {} }))).toEqual([]);
    expect(dots(mount('host', { online: { maria: true } }))).toEqual([]);
  });
});

describe('LobbyScreen scoreboard and start', () => {
  it('has no scoreboard in the first round', () => {
    expect(mount('host').root.findAllByType(Scoreboard)).toHaveLength(0);
  });

  it('shows the scoreboard and the round from the second round on', () => {
    const game = { ...lobby(), round: 2, scores: { maria: 1 } };
    const renderer = mount('host', { game });
    expect(renderer.root.findAllByType(Scoreboard)).toHaveLength(1);
    expect(texts(renderer)).toContain('JOIN CODE · ROUND 2');
    expect(rendered(renderer)).toContain('MARIA: 1 win');
  });

  it('lets only the host start, and everyone leave', () => {
    const asHost = mount('host');
    press(asHost, 'start');
    expect(mockStart).toHaveBeenCalledTimes(1);

    const asGuest = mount('maria');
    expect(findButton(asGuest, 'start')).toBeUndefined();
    expect(texts(asGuest)).toContain('Waiting for the host to start…');
    act(() => {
      asGuest.root.findByProps({ label: 'Leave' }).props.onPress();
    });
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it('stacks in portrait and sits side by side in landscape', () => {
    const direction = (width: number, height: number) => {
      jest
        .spyOn(Dimensions, 'get')
        .mockReturnValue({ width, height, scale: 1, fontScale: 1 });
      const root = mount('host').toJSON() as unknown as {
        children: { props: { style: { flexDirection?: string } } }[];
      };
      const layout = root.children[root.children.length - 1];
      return layout.props.style.flexDirection ?? 'column';
    };
    expect(direction(640, 360)).toBe('row');
    expect(direction(360, 640)).toBe('column');
  });
});
