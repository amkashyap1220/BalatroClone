import { createRun } from '../src/engine/run';
import { botStep } from '../src/engine/bot';
test('sim', () => {
  const antes: number[] = [];
  for (let s = 0; s < 40; s++) {
    let run = createRun({ seed: 'BAL' + s });
    const rng = { s: s * 7 + 1 };
    const st = { actions: 0, errors: [] as string[] };
    for (let i = 0; i < 4000 && run.phase !== 'gameOver' && !run.won; i++) run = botStep(run, rng, st);
    antes.push(run.won ? 9 : run.ante);
  }
  antes.sort((a, b) => a - b);
  console.log('antes', antes.join(','), 'avg', antes.reduce((a, b) => a + b, 0) / antes.length);
}, 120000);
