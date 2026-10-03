import { NativeModules } from 'react-native';
import { playSound, SOUND_NAMES } from '../sound';

const modules = NativeModules as Record<string, unknown>;

afterEach(() => {
  delete modules.CoupSound;
});

describe('playSound', () => {
  it('does nothing, quietly, when there is no native player (as under Jest)', () => {
    expect(modules.CoupSound).toBeUndefined();
    SOUND_NAMES.forEach(name => {
      expect(() => playSound(name)).not.toThrow();
    });
  });

  it('asks the native player for the sound by name', () => {
    const play = jest.fn();
    modules.CoupSound = { play };
    playSound('coin');
    playSound('turn');
    expect(play.mock.calls).toEqual([['coin'], ['turn']]);
  });

  it('survives a native player that throws', () => {
    modules.CoupSound = {
      play: () => {
        throw new Error('no audio');
      },
    };
    expect(() => playSound('win')).not.toThrow();
  });

  it('survives a native player without a play method', () => {
    modules.CoupSound = {};
    expect(() => playSound('card')).not.toThrow();
  });

  it('knows the seven sounds the generator makes', () => {
    const { SOUNDS } = require('../../../scripts/generate-sounds');
    expect([...SOUND_NAMES].sort()).toEqual(Object.keys(SOUNDS).sort());
  });
});
