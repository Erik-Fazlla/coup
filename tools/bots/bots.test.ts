/**
 * Two scripted players join the lobby whose code is in BOT_CODE and play simply:
 * Income on their turn, pass on every prompt (or, with BOT_CHALLENGE=1, challenge every
 * claimed character), give up their first card when asked.
 * They stop after BOT_MINUTES (default 10) or when the game is over. If the game is
 * still in the lobby at that point, they leave it before disconnecting.
 *
 *   BOT_CODE=ABCDE npx jest --config jest.bots.config.js
 */
/// <reference types="node" />
import { deleteApp, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { pendingResponders } from '../../src/engine/rules';
import { Game } from '../../src/engine/types';
import { firebaseConfig } from '../../src/firebase/config';
import { createGameService } from '../../src/firebase/gameService';

const code = (process.env.BOT_CODE ?? '').trim().toUpperCase();
const minutes = Number(process.env.BOT_MINUTES ?? '10');
const challenging = process.env.BOT_CHALLENGE === '1';

function bot(name: string) {
  const app = initializeApp(firebaseConfig, `bot-${name}`);
  const service = createGameService(getDatabase(app));
  const playerId = `bot-${name.toLowerCase()}-${Date.now()}`;
  return { app, service, playerId, name };
}

async function act(b: ReturnType<typeof bot>, gameId: string, game: Game) {
  const { state } = game;
  const me = b.playerId;
  if (state.phase === 'action' && state.currentTurnPlayer === me) {
    await b.service.dispatch(gameId, { type: 'income', playerId: me });
  } else if (
    challenging &&
    state.phase === 'awaitingResponses' &&
    state.pending?.claim &&
    !state.pending.challengeResolved &&
    pendingResponders(game).includes(me)
  ) {
    // BOT_CHALLENGE=1: doubt every claimed character, to show the challenge scene.
    await b.service.dispatch(gameId, {
      type: 'challenge',
      playerId: me,
      seq: state.claimSeq,
    });
  } else if (
    (state.phase === 'awaitingResponses' ||
      state.phase === 'awaitingBlockResponses') &&
    pendingResponders(game).includes(me)
  ) {
    await b.service.dispatch(gameId, {
      type: 'pass',
      playerId: me,
      seq: state.claimSeq,
    });
  } else if (
    state.phase === 'loseInfluence' &&
    state.pending?.loseInfluence?.playerId === me
  ) {
    const index = game.players[me].influence.findIndex(card => !card.revealed);
    await b.service.dispatch(gameId, {
      type: 'loseInfluence',
      playerId: me,
      cardIndex: index,
    });
  }
}

it('plays as two extra players', async () => {
  expect(code).toMatch(/^[A-Z0-9]{5}$/);
  const bots = [bot('Ana'), bot('Nikos')];
  const gameIds = await Promise.all(
    bots.map(b => b.service.joinGame(code, b.playerId, b.name)),
  );
  const stops: Array<() => void> = [];
  const lastGames: Array<Game | null> = bots.map(() => null);
  await new Promise<void>(resolve => {
    const end = setTimeout(resolve, minutes * 60 * 1000);
    bots.forEach((b, i) => {
      let busy = false;
      let latest: Game | null = null;
      // Snapshots that arrive while the bot is busy are kept (only the newest), and
      // handled as soon as it is free: its own move may have produced a state it must act on.
      const run = () => {
        if (busy || !latest) return;
        const game = latest;
        latest = null;
        busy = true;
        act(b, gameIds[i], game)
          .catch(error => console.warn(`${b.name}: ${error}`))
          .finally(() => {
            busy = false;
            run();
          });
      };
      stops.push(
        b.service.subscribe(
          gameIds[i],
          game => {
            if (!game || game.status === 'finished') {
              lastGames[i] = game;
              clearTimeout(end);
              resolve();
              return;
            }
            lastGames[i] = game;
            latest = game;
            run();
          },
          error => console.warn(`${b.name}: ${error}`),
        ),
      );
    });
  });
  stops.forEach(stop => stop());
  // Leave a lobby that never started, so the bots do not linger as players.
  await Promise.all(
    bots.map(async (b, i) => {
      if (lastGames[i]?.status === 'waiting') {
        await b.service.leaveLobby(gameIds[i], b.playerId);
      }
    }),
  );
  await Promise.all(bots.map(b => deleteApp(b.app)));
});
