/**
 * Two scripted players join the lobby whose code is in BOT_CODE and play simply:
 * Income on their turn, pass on every prompt, give up their first card when asked.
 * They stop after BOT_MINUTES (default 10) or when the game is over, then leave.
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
  await new Promise<void>(resolve => {
    const end = setTimeout(resolve, minutes * 60 * 1000);
    bots.forEach((b, i) => {
      let busy = false;
      stops.push(
        b.service.subscribe(
          gameIds[i],
          game => {
            if (!game || game.status === 'finished') {
              clearTimeout(end);
              resolve();
              return;
            }
            if (busy) return;
            busy = true;
            act(b, gameIds[i], game)
              .catch(error => console.warn(`${b.name}: ${error}`))
              .finally(() => {
                busy = false;
              });
          },
          error => console.warn(`${b.name}: ${error}`),
        ),
      );
    });
  });
  stops.forEach(stop => stop());
  await Promise.all(bots.map(b => deleteApp(b.app)));
});
