// AI 봇 — 위험 회피(BFS) > 공격 > 아이템/상자 탐색 우선순위의 상태 기반 컨트롤러

import {
  TILE, COLS, ROWS, T_EMPTY, T_BOX, T_SOLID,
  ST_ALIVE, ST_TRAPPED, ST_DEAD, DIRS,
} from './constants.js';
import { inBounds } from './map.js';

const DIR_NAMES = ['up', 'down', 'left', 'right'];

export class AIController {
  constructor(player, game) {
    this.p = player;
    this.game = game;
    this.thinkTimer = Math.random() * 0.3;
    this.path = [];           // [{gx, gy}, ...]
    this.moveDir = null;
    this.placeCooldown = 1 + Math.random() * 2;
    this.needleDelay = 0;     // 갇힌 후 바늘 사용까지 망설임
  }

  update(dt) {
    const p = this.p;
    const g = this.game;
    if (p.state === ST_DEAD) return;

    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.12 + Math.random() * 0.08;
      this.think();
    }

    // 갇힘: 바늘 사용 판단
    if (p.state === ST_TRAPPED) {
      if (p.needles > 0) {
        this.needleDelay -= dt;
        if (this.needleDelay <= 0) g.useNeedle(p);
      }
      // 갇힌 상태에선 느릿느릿 이동
      g.movePlayer(p, this.moveDir, dt);
      return;
    }

    g.movePlayer(p, this.moveDir, dt);
  }

  think() {
    const p = this.p;
    const g = this.game;

    if (p.state === ST_TRAPPED) {
      if (this.needleDelay === 0) this.needleDelay = 0.4 + Math.random() * 0.8;
      this.moveDir = DIR_NAMES[Math.floor(Math.random() * 4)];
      return;
    }

    const danger = this.buildDangerMap();
    const gx = p.gx, gy = p.gy;

    // 1) 현재 위치가 위험하면 탈출
    if (danger[gy][gx]) {
      const path = this.bfs(gx, gy, (x, y) => !danger[y][x], danger, true);
      this.followPath(path);
      return;
    }

    // 2) 공격/파괴 기회: 사거리 내 적 또는 인접 상자 → 풍선 설치 (탈출로 확보 시)
    if (this.placeCooldown <= 0 && p.activeBalloons < p.maxBalloons && !g.balloonAt(gx, gy)) {
      const worthIt = this.enemyInLine(gx, gy, p.streamLen) || this.adjacentBox(gx, gy);
      if (worthIt && this.canEscapeAfterPlacing(gx, gy, p.streamLen, danger)) {
        g.placeBalloon(p);
        this.placeCooldown = 0.8 + Math.random() * 1.2;
        // 즉시 탈출 경로 갱신
        const newDanger = this.buildDangerMap();
        const path = this.bfs(gx, gy, (x, y) => !newDanger[y][x], newDanger, true);
        this.followPath(path);
        return;
      }
    }

    // 3) 갇힌 적에게 접근해 처치
    const trapped = g.players.find((o) => o !== p && o.state === ST_TRAPPED);
    if (trapped) {
      const path = this.bfs(gx, gy, (x, y) => x === trapped.gx && y === trapped.gy, danger);
      if (path) { this.followPath(path); return; }
    }

    // 4) 아이템 수집
    if (g.items.length > 0) {
      const path = this.bfs(gx, gy, (x, y) => g.items.some((it) => it.gx === x && it.gy === y), danger);
      if (path && path.length <= 14) { this.followPath(path); return; }
    }

    // 5) 가까운 상자 옆으로 이동 (부수러 가기)
    const boxPath = this.bfs(gx, gy, (x, y) => this.adjacentBox(x, y), danger);
    if (boxPath) { this.followPath(boxPath); return; }

    // 6) 적에게 접근
    const enemies = g.players.filter((o) => o !== p && o.state === ST_ALIVE);
    if (enemies.length > 0) {
      const e = enemies[0];
      const path = this.bfs(gx, gy, (x, y) => Math.abs(x - e.gx) + Math.abs(y - e.gy) <= 1, danger);
      if (path) { this.followPath(path); return; }
    }

    this.moveDir = null;
  }

  followPath(path) {
    if (!path || path.length === 0) { this.moveDir = null; return; }
    const p = this.p;
    const next = path[0];
    const cx = next.gx * TILE + TILE / 2;
    const cy = next.gy * TILE + TILE / 2;
    // 현재 칸 도착 시 다음 노드로
    if (Math.abs(p.px - cx) < 3 && Math.abs(p.py - cy) < 3) {
      path.shift();
      if (path.length === 0) { this.moveDir = null; return; }
      return this.followPath(path);
    }
    if (Math.abs(cx - p.px) > Math.abs(cy - p.py)) {
      this.moveDir = cx > p.px ? 'right' : 'left';
    } else {
      this.moveDir = cy > p.py ? 'down' : 'up';
    }
  }

  // 풍선 폭발 예상 범위 + 현재 물줄기를 위험 칸으로 마킹
  buildDangerMap() {
    const g = this.game;
    const danger = [];
    for (let y = 0; y < ROWS; y++) danger.push(new Array(COLS).fill(false));

    for (const w of g.waters) danger[w.gy][w.gx] = true;

    for (const b of g.balloons) {
      danger[b.gy][b.gx] = true;
      for (const dn of DIR_NAMES) {
        const { dx, dy } = DIRS[dn];
        for (let i = 1; i <= b.streamLen; i++) {
          const x = b.gx + dx * i, y = b.gy + dy * i;
          if (!inBounds(x, y)) break;
          const t = g.grid[y][x];
          if (t === T_SOLID) break;
          danger[y][x] = true;
          if (t === T_BOX) break;
        }
      }
    }
    return danger;
  }

  // BFS: goal(x,y) 만족하는 가장 가까운 칸까지의 경로 반환 (시작 칸 제외)
  // avoidDanger=true면 위험 칸도 통과 가능(탈출용)하되 비용 가중치 부여
  bfs(sx, sy, goalFn, danger, escaping = false) {
    const g = this.game;
    const visited = new Set([sx + ',' + sy]);
    const queue = [{ x: sx, y: sy, path: [] }];

    while (queue.length > 0) {
      const cur = queue.shift();
      if (goalFn(cur.x, cur.y) && !(cur.x === sx && cur.y === sy)) {
        return cur.path;
      }
      if (cur.path.length > 24) continue;
      for (const dn of DIR_NAMES) {
        const { dx, dy } = DIRS[dn];
        const nx = cur.x + dx, ny = cur.y + dy;
        const key = nx + ',' + ny;
        if (visited.has(key)) continue;
        if (!inBounds(nx, ny)) continue;
        if (g.grid[ny][nx] !== T_EMPTY) continue;
        if (g.balloonAt(nx, ny)) continue;
        // 탈출 중이 아니면 위험 칸 회피
        if (!escaping && danger[ny][nx]) continue;
        // 탈출 중에도 현재 물이 있는 칸은 즉사라 회피
        if (escaping && g.waterAt(nx, ny)) continue;
        visited.add(key);
        queue.push({ x: nx, y: ny, path: [...cur.path, { gx: nx, gy: ny }] });
      }
    }
    return null;
  }

  enemyInLine(gx, gy, range) {
    const g = this.game;
    for (const o of g.players) {
      if (o === this.p || o.state === ST_DEAD) continue;
      if (o.gy === gy && Math.abs(o.gx - gx) <= range && this.clearLine(gx, gy, o.gx, o.gy)) return true;
      if (o.gx === gx && Math.abs(o.gy - gy) <= range && this.clearLine(gx, gy, o.gx, o.gy)) return true;
    }
    return false;
  }

  clearLine(x0, y0, x1, y1) {
    const g = this.game;
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    let x = x0 + dx, y = y0 + dy;
    while (x !== x1 || y !== y1) {
      if (g.grid[y][x] !== T_EMPTY || g.balloonAt(x, y)) return false;
      x += dx; y += dy;
    }
    return true;
  }

  adjacentBox(gx, gy) {
    const g = this.game;
    for (const dn of DIR_NAMES) {
      const { dx, dy } = DIRS[dn];
      const x = gx + dx, y = gy + dy;
      if (inBounds(x, y) && g.grid[y][x] === T_BOX) return true;
    }
    return false;
  }

  // 이 자리에 풍선을 놓아도 안전 칸으로 도망갈 수 있는지 시뮬레이션
  canEscapeAfterPlacing(gx, gy, streamLen, danger) {
    const simDanger = danger.map((row) => [...row]);
    simDanger[gy][gx] = true;
    for (const dn of DIR_NAMES) {
      const { dx, dy } = DIRS[dn];
      for (let i = 1; i <= streamLen; i++) {
        const x = gx + dx * i, y = gy + dy * i;
        if (!inBounds(x, y)) break;
        const t = this.game.grid[y][x];
        if (t === T_SOLID) break;
        simDanger[y][x] = true;
        if (t === T_BOX) break;
      }
    }
    const path = this.bfs(gx, gy, (x, y) => !simDanger[y][x], simDanger, true);
    return path !== null && path.length <= 8;
  }
}
