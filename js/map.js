// 맵 생성 — 15×13 그리드. 격자형 고정 블록 + 랜덤 상자, 스폰 모서리는 비워둔다.

import { COLS, ROWS, T_EMPTY, T_SOLID, T_BOX, SPAWNS } from './constants.js';

export function generateMap(rng = Math.random) {
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    grid.push(new Array(COLS).fill(T_EMPTY));
  }

  // 고정 블록: 홀수 행/열 격자 패턴 (봄버맨 클래식) — 단 가장자리 안쪽으로
  for (let y = 1; y < ROWS - 1; y += 2) {
    for (let x = 1; x < COLS - 1; x += 2) {
      grid[y][x] = T_SOLID;
    }
  }

  // 랜덤 상자 채우기 (약 55%)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === T_EMPTY && rng() < 0.55) {
        grid[y][x] = T_BOX;
      }
    }
  }

  // 스폰 지점 주변 3칸(자기 칸 + 인접 2칸)은 비운다
  for (const { gx, gy } of SPAWNS) {
    clearAround(grid, gx, gy);
  }

  return grid;
}

function clearAround(grid, gx, gy) {
  const cells = [
    [gx, gy],
    [gx + 1, gy], [gx - 1, gy],
    [gx, gy + 1], [gx, gy - 1],
    [gx + 2, gy], [gx - 2, gy],
    [gx, gy + 2], [gx, gy - 2],
  ];
  for (const [x, y] of cells) {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS && grid[y][x] === T_BOX) {
      grid[y][x] = T_EMPTY;
    }
  }
}

export function inBounds(gx, gy) {
  return gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
}
