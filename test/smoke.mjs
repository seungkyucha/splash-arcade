// Node 환경 스모크 테스트 — 맵 생성, 게임 로직, AI 시뮬레이션 검증
// 실행: node test/smoke.mjs

import { generateMap } from '../js/map.js';
import { Game } from '../js/game.js';
import {
  COLS, ROWS, T_EMPTY, T_SOLID, SPAWNS,
  ST_ALIVE, ST_TRAPPED, ST_DEAD, BALLOON_FUSE, WATER_DURATION, TRAP_DURATION,
} from '../js/constants.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

console.log('[1] 맵 생성');
{
  const grid = generateMap();
  assert(grid.length === ROWS && grid[0].length === COLS, `맵 크기 ${COLS}x${ROWS}`);
  let solids = 0;
  for (let y = 1; y < ROWS - 1; y += 2)
    for (let x = 1; x < COLS - 1; x += 2)
      if (grid[y][x] === T_SOLID) solids++;
  assert(solids === 7 * 6, '고정 블록 격자 패턴 존재');
  const allSpawnsClear = SPAWNS.every(({ gx, gy }) => grid[gy][gx] === T_EMPTY);
  assert(allSpawnsClear, '모든 스폰 지점이 비어 있음');
}

console.log('[2] 게임 초기화');
const game = new Game(0);
{
  assert(game.players.length === 4, '플레이어 4명 (사람 1 + AI 3)');
  assert(game.human.isHuman === true, '첫 플레이어가 사람');
  const ids = new Set(game.players.map((p) => p.charId));
  assert(ids.size === 4, '캐릭터 중복 없음');
  assert(game.human.needles === 1, '사람 플레이어 바늘 1개 보유');
}

console.log('[3] 물풍선 설치와 폭발');
{
  const h = game.human;
  const ok = game.placeBalloon(h);
  assert(ok, '물풍선 설치 성공');
  assert(game.balloons.length === 1, '풍선 1개 존재');
  assert(h.activeBalloons === 1, '설치 카운트 증가');
  const dup = game.placeBalloon(h);
  assert(!dup, '같은 칸/최대 개수 초과 설치 불가');

  // 퓨즈가 다 탈 때까지 진행 (사람은 입력 없음)
  const input = { dir: null, action: false };
  for (let t = 0; t < BALLOON_FUSE + 0.1; t += 1 / 60) {
    game.update(1 / 60, input);
  }
  assert(!game.balloons.some((b) => b.owner === h), '퓨즈 후 풍선 폭발 (사람 소유 풍선 없음)');
  assert(h.activeBalloons === 0, '폭발 후 설치 카운트 복구');
}

console.log('[4] 물줄기 → 갇힘 → 사망');
{
  const h = game.human;
  // 사람을 안전 위치에 두고 강제로 물 생성
  game.waters.length = 0;
  h.state = ST_ALIVE;
  h.immuneTimer = 0;
  game.addWater(h.gx, h.gy, 'center');
  const input = { dir: null, action: false };
  game.update(1 / 60, input);
  assert(h.state === ST_TRAPPED, '물줄기에 닿으면 갇힘');

  // 바늘 사용 (action)
  input.action = true;
  game.update(1 / 60, input);
  assert(h.state === ST_ALIVE && h.needles === 0, '바늘로 탈출, 바늘 소모');
  assert(h.immuneTimer > 0, '탈출 직후 무적 시간 부여');

  // 다시 가두고 시간 초과 → 사망
  h.immuneTimer = 0;
  game.waters.length = 0;
  game.addWater(h.gx, h.gy, 'center');
  game.update(1 / 60, input);
  // 물이 빠지기 전에 갇힘 확인
  assert(h.state === ST_TRAPPED, '바늘 없이 다시 갇힘');
  h.trapTimer = 0.01;
  game.update(1 / 60, input);
  assert(h.state === ST_DEAD, '갇힘 시간 초과 시 사망');
}

console.log('[5] AI 시뮬레이션 (60초, 예외 없이 동작)');
{
  const g2 = new Game(1);
  const input = { dir: null, action: false };
  let error = null;
  try {
    for (let t = 0; t < 60 && !g2.over; t += 1 / 60) {
      g2.update(1 / 60, input);
    }
  } catch (e) {
    error = e;
  }
  assert(error === null, `AI 시뮬레이션 무오류 ${error ? '(' + error.message + ')' : ''}`);
  const aliveCount = g2.players.filter((p) => p.state !== ST_DEAD).length;
  console.log(`    → 60초 후 생존자: ${aliveCount}/4, 종료: ${g2.over}, 결과: ${g2.result}`);
  // AI들이 뭔가 활동했는지 (블록 파괴 흔적)
  let boxes = 0;
  for (const row of g2.grid) for (const c of row) if (c === 2) boxes++;
  console.log(`    → 남은 상자: ${boxes}`);
  assert(g2.players.some((p) => p.maxBalloons > 1 || p.streamLen > 1 || p.speed > 1) || boxes < 80,
    'AI가 게임을 진행함 (블록 파괴/아이템 획득)');
}

console.log('[6] 라운드 타임아웃 → 무승부');
{
  const g3 = new Game(2);
  const input = { dir: null, action: false };
  g3.time = 0.05;
  g3.update(0.1, input);
  assert(g3.over && g3.result === 'draw', '시간 초과 시 무승부 처리');
}

console.log(`\n결과: ${passed} 통과, ${failed} 실패`);
process.exit(failed > 0 ? 1 : 0);
