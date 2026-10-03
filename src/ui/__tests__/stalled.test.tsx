import React from 'react';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { render } from '../../components/testUtils';
import { makeGame, play } from '../../engine/testHelpers';
import { isOnline, knownPresence } from '../presence';
import { SKIP_AFTER_MS, useStalled, waitKey } from '../stalled';

const table = () =>
  makeGame({
    a: ['Duke', 'Captain'],
    b: ['Contessa', 'Assassin'],
    c: ['Ambassador', 'Duke'],
  });

describe('waitKey', () => {
  it('is null without a game, in the lobby and after the end', () => {
    expect(waitKey(null)).toBeNull();
    expect(waitKey({ ...table(), status: 'waiting' })).toBeNull();
    expect(waitKey({ ...table(), status: 'finished' })).toBeNull();
  });

  it('stays the same for the same wait', () => {
    expect(waitKey(table())).toBe(waitKey({ ...table(), log: ['noise'] }));
  });

  it('changes with the turn, the phase, the claim and who is waited on', () => {
    const start = table();
    const asked = play(start, { type: 'tax', playerId: 'a' });
    const onePassed = play(asked, { type: 'pass', playerId: 'b' });
    const nextTurn = play(onePassed, { type: 'pass', playerId: 'c' });
    const keys = [start, asked, onePassed, nextTurn].map(waitKey);
    expect(keys.every(key => key !== null)).toBe(true);
    expect(new Set(keys).size).toBe(4);
  });
});

describe('useStalled', () => {
  let stalled = false;

  function Probe({ waitingFor }: { waitingFor: string | null }) {
    stalled = useStalled(waitingFor);
    return null;
  }

  const deliver = (renderer: ReactTestRenderer, key: string | null) =>
    act(() => {
      renderer.update(<Probe waitingFor={key} />);
    });

  const wait = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('becomes true only after 45 seconds of the same wait', () => {
    expect(SKIP_AFTER_MS).toBe(45000);
    render(<Probe waitingFor="turn-1" />);
    expect(stalled).toBe(false);
    wait(SKIP_AFTER_MS - 1);
    expect(stalled).toBe(false);
    wait(1);
    expect(stalled).toBe(true);
  });

  it('starts counting again when the wait changes', () => {
    const renderer = render(<Probe waitingFor="turn-1" />);
    wait(SKIP_AFTER_MS - 1000);
    deliver(renderer, 'turn-2');
    wait(1000);
    expect(stalled).toBe(false);
    wait(SKIP_AFTER_MS - 1000);
    expect(stalled).toBe(true);
  });

  it('drops back to false the moment the game moves on', () => {
    const renderer = render(<Probe waitingFor="turn-1" />);
    wait(SKIP_AFTER_MS);
    expect(stalled).toBe(true);
    deliver(renderer, 'turn-2');
    expect(stalled).toBe(false);
  });

  it('is not restarted by snapshots of the same wait', () => {
    const renderer = render(<Probe waitingFor="turn-1" />);
    wait(SKIP_AFTER_MS - 1000);
    deliver(renderer, 'turn-1');
    wait(1000);
    expect(stalled).toBe(true);
  });

  it('never stalls when nobody is being waited on', () => {
    const renderer = render(<Probe waitingFor={null} />);
    wait(SKIP_AFTER_MS * 2);
    expect(stalled).toBe(false);

    deliver(renderer, 'turn-1');
    wait(SKIP_AFTER_MS);
    expect(stalled).toBe(true);
    deliver(renderer, null);
    expect(stalled).toBe(false);
  });
});

describe('knownPresence', () => {
  it('is unknown when presence cannot be read', () => {
    expect(knownPresence(null, 'me')).toBeNull();
    expect(knownPresence(undefined, 'me')).toBeNull();
  });

  it('is unknown until the list contains this device', () => {
    expect(knownPresence({}, 'me')).toBeNull();
    expect(knownPresence({ other: true }, 'me')).toBeNull();
  });

  it('is the list once this device is in it', () => {
    const presence = knownPresence({ me: true, other: true }, 'me');
    expect(isOnline(presence, 'other')).toBe(true);
    expect(isOnline(presence, 'third')).toBe(false);
  });

  it('draws no dot while unknown', () => {
    expect(isOnline(null, 'other')).toBeNull();
  });
});
