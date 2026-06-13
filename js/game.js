// 핵심 게임 로직 — 플레이어, 물풍선, 물줄기, 아이템, 승패 판정

import {
  TILE, COLS, ROWS,
  T_EMPTY, T_SOLID, T_BOX,
  ST_ALIVE, ST_TRAPPED, ST_DEAD,
  MAX_BALLOONS, MAX_STREAM, MAX_SPEED,
  BALLOON_FUSE, WATER_DURATION, TRAP_DURATION, ROUND_TIME, ITEM_DROP_RATE,
  SPEED_TABLE, TRAPPED_SPEED, ITEMS, SPAWNS, DIRS, CHARACTERS,
} from './constants.js';
import { generateMap, inBounds } from './map.js';
import { sfx } from './sound.js';
import { AIController } from './ai.js';

const ITEM_KEYS = Object.keys(ITEMS);
const ITEM_TOTAL_WEIGHT = ITEM_KEYS.reduce((s, k) => s + ITEMS[k].weight, 0);

function rollItem() {
  let r = Math.random() * ITEM_TOTAL_WEIGHT;
  for (const k of ITEM_KEYS) {
    r -= ITEMS[k].weight;
    if (r <= 0) return k;
  }
  return 'BALLOON';
}

export function tileCenter(g) {
  return g * TILE + TILE / 2;
}

export function toGrid(p) {
  return Math.floor(p / TILE);
}

export class Player {
  constructor(charIdx, spawnIdx, isHuman) {
    const ch = CHARACTERS[charIdx];
    this.charId = ch.id;
    this.name = ch.name;
    this.isHuman = isHuman;
    this.px = tileCenter(SPAWNS[spawnIdx].gx);
    this.py = tileCenter(SPAWNS[spawnIdx].gy);
    this.dir = 'down';
    this.moving = false;
    this.state = ST_ALIVE;
    this.trapTimer = 0;
    this.immuneTimer = 0;   // 바늘 탈출 직후 잠시 무적
    this.walkAnim = 0;

    // 능력치
    this.maxBalloons = 1;
    this.streamLen = 1;
    this.speed = 1;
    this.needles = isHuman ? 1 : 0;  // 플레이어는 바늘 1개로 시작
    this.activeBalloons = 0;
  }

  get gx() { return toGrid(this.px); }
  get gy() { return toGrid(this.py); }

  moveSpeed() {
    return this.state === ST_TRAPPED ? TRAPPED_SPEED : SPEED_TABLE[this.speed];
  }
}

export class Game {
  constructor(humanCharIdx) {
    this.grid = generateMap();
    this.players = [];
    this.balloons = [];   // {gx, gy, timer, owner, streamLen, anim}
    this.waters = [];     // {gx, gy, kind, timer}
    this.items = [];      // {gx, gy, type}
    this.effects = [];    // {x, y, type, timer, ...}
    this.pendingItems = []; // 박스 파괴 후 물 빠지면 등장할 아이템
    this.time = ROUND_TIME;
    this.over = false;
    this.result = null;   // 'win' | 'lose' | 'draw'
    this.resultDelay = 0;
    this.shake = 0;

    // 플레이어 1명 + AI 3명 (서로 다른 캐릭터 배정)
    const aiChars = [0, 1, 2, 3].filter((i) => i !== humanCharIdx);
    this.players.push(new Player(humanCharIdx, 0, true));
    for (let i = 0; i < 3; i++) {
      this.players.push(new Player(aiChars[i], i + 1, false));
    }
    this.ai = this.players.filter((p) => !p.isHuman).map((p) => new AIController(p, this));
  }

  get human() { return this.players[0]; }

  // ---------- 충돌/이동 ----------

  balloonAt(gx, gy) {
    return this.balloons.find((b) => b.gx === gx && b.gy === gy) || null;
  }

  isWalkable(gx, gy, ignoreBalloonTile = null) {
    if (!inBounds(gx, gy)) return false;
    const t = this.grid[gy][gx];
    if (t === T_SOLID || t === T_BOX) return false;
    const b = this.balloonAt(gx, gy);
    if (b && !(ignoreBalloonTile && ignoreBalloonTile.gx === gx && ignoreBalloonTile.gy === gy)) {
      return false;
    }
    return true;
  }

  // 그리드 레일 기반 이동: 진행 방향 다음 칸이 막혀 있으면 현재 칸 중앙에서 멈춘다.
  movePlayer(p, dir, dt) {
    if (!dir) { p.moving = false; return; }
    p.dir = dir;
    p.moving = true;
    p.walkAnim += dt * 10;

    const sp = p.moveSpeed() * dt;
    const { dx, dy } = DIRS[dir];
    const gx = p.gx, gy = p.gy;
    const cx = tileCenter(gx), cy = tileCenter(gy);
    const standing = { gx, gy }; // 자기 발밑 풍선은 통과 허용

    if (dx !== 0) {
      // 수직 위치를 행 중앙으로 정렬
      p.py = approach(p.py, cy, sp);
      const ahead = p.px + dx * sp;
      const crossesCenter = dx > 0 ? ahead > cx : ahead < cx;
      if (!crossesCenter || this.isWalkable(gx + dx, gy, standing)) {
        p.px = ahead;
      } else {
        p.px = cx;
      }
    } else {
      p.px = approach(p.px, cx, sp);
      const ahead = p.py + dy * sp;
      const crossesCenter = dy > 0 ? ahead > cy : ahead < cy;
      if (!crossesCenter || this.isWalkable(gx, gy + dy, standing)) {
        p.py = ahead;
      } else {
        p.py = cy;
      }
    }

    // 경계 클램프
    p.px = Math.max(TILE / 2, Math.min(COLS * TILE - TILE / 2, p.px));
    p.py = Math.max(TILE / 2, Math.min(ROWS * TILE - TILE / 2, p.py));
  }

  // ---------- 물풍선 ----------

  placeBalloon(p) {
    if (p.state !== ST_ALIVE) return false;
    if (p.activeBalloons >= p.maxBalloons) return false;
    const gx = p.gx, gy = p.gy;
    if (this.balloonAt(gx, gy)) return false;
    if (this.grid[gy][gx] !== T_EMPTY) return false;
    this.balloons.push({ gx, gy, timer: BALLOON_FUSE, owner: p, streamLen: p.streamLen, anim: 0 });
    p.activeBalloons++;
    sfx.place();
    return true;
  }

  explodeBalloon(b, exploded = new Set()) {
    const key = b.gx + ',' + b.gy;
    if (exploded.has(key)) return;
    exploded.add(key);

    const idx = this.balloons.indexOf(b);
    if (idx >= 0) this.balloons.splice(idx, 1);
    b.owner.activeBalloons = Math.max(0, b.owner.activeBalloons - 1);

    this.addWater(b.gx, b.gy, 'center');

    for (const dirName of ['up', 'down', 'left', 'right']) {
      const { dx, dy } = DIRS[dirName];
      for (let i = 1; i <= b.streamLen; i++) {
        const x = b.gx + dx * i, y = b.gy + dy * i;
        if (!inBounds(x, y)) break;
        const t = this.grid[y][x];
        if (t === T_SOLID) break;
        if (t === T_BOX) {
          // 상자 파괴: 물이 상자 칸을 덮고 멈춘다
          this.grid[y][x] = T_EMPTY;
          this.addWater(x, y, dirName === 'left' || dirName === 'right' ? 'h' : 'v', true);
          this.effects.push({ type: 'boxBreak', x: tileCenter(x), y: tileCenter(y), timer: 0.4 });
          sfx.boxBreak();
          if (Math.random() < ITEM_DROP_RATE) {
            this.pendingItems.push({ gx: x, gy: y, type: rollItem(), delay: WATER_DURATION + 0.05 });
          }
          break;
        }
        // 아이템 파괴 후 멈춤
        const itIdx = this.items.findIndex((it) => it.gx === x && it.gy === y);
        if (itIdx >= 0) {
          this.items.splice(itIdx, 1);
          this.addWater(x, y, i === b.streamLen ? dirName : (dx !== 0 ? 'h' : 'v'), true);
          break;
        }
        // 다른 풍선 연쇄 폭발
        const other = this.balloonAt(x, y);
        if (other) {
          this.addWater(x, y, dx !== 0 ? 'h' : 'v');
          this.explodeBalloon(other, exploded);
          break;
        }
        const isEnd = i === b.streamLen;
        this.addWater(x, y, isEnd ? dirName : (dx !== 0 ? 'h' : 'v'));
      }
    }

    sfx.pop();
    this.shake = 0.25;
  }

  addWater(gx, gy, kind, capEnd = false) {
    const existing = this.waters.find((w) => w.gx === gx && w.gy === gy);
    if (existing) {
      existing.timer = WATER_DURATION;
      if (kind === 'center') existing.kind = 'center';
      return;
    }
    this.waters.push({ gx, gy, kind, timer: WATER_DURATION });
  }

  waterAt(gx, gy) {
    return this.waters.some((w) => w.gx === gx && w.gy === gy);
  }

  // ---------- 아이템 ----------

  applyItem(p, type) {
    switch (type) {
      case 'BALLOON': p.maxBalloons = Math.min(MAX_BALLOONS, p.maxBalloons + 1); break;
      case 'POTION': p.streamLen = Math.min(MAX_STREAM, p.streamLen + 1); break;
      case 'ROLLER': p.speed = Math.min(MAX_SPEED, p.speed + 1); break;
      case 'NEEDLE': p.needles++; break;
      case 'ULTRA': p.streamLen = MAX_STREAM; break;
      case 'DEVIL': p.speed = MAX_SPEED; break;
    }
    sfx.pickup();
    this.effects.push({ type: 'sparkle', x: p.px, y: p.py - 20, timer: 0.5 });
  }

  useNeedle(p) {
    if (p.state !== ST_TRAPPED || p.needles <= 0) return false;
    p.needles--;
    p.state = ST_ALIVE;
    p.trapTimer = 0;
    p.immuneTimer = 1.5;
    sfx.needle();
    this.effects.push({ type: 'popBubble', x: p.px, y: p.py, timer: 0.3 });
    return true;
  }

  // ---------- 업데이트 ----------

  update(dt, humanInput) {
    if (this.over) return;

    // 라운드 타이머
    const prevTime = Math.ceil(this.time);
    this.time -= dt;
    if (Math.ceil(this.time) < prevTime && this.time <= 10 && this.time > 0) sfx.tick();
    if (this.time <= 0) {
      this.endRound('draw');
      return;
    }

    this.shake = Math.max(0, this.shake - dt);

    // 사람 플레이어 입력
    const human = this.human;
    if (human.state !== ST_DEAD) {
      if (humanInput.action) {
        if (human.state === ST_TRAPPED) this.useNeedle(human);
        else this.placeBalloon(human);
        humanInput.action = false;
      }
      this.movePlayer(human, humanInput.dir, dt);
      if (!humanInput.dir) human.moving = false;
    }

    // AI
    for (const ctrl of this.ai) ctrl.update(dt);

    // 풍선 타이머
    for (const b of [...this.balloons]) {
      b.timer -= dt;
      b.anim += dt;
      if (b.timer <= 0 && this.balloons.includes(b)) {
        this.explodeBalloon(b);
      }
    }

    // 물줄기 타이머
    for (let i = this.waters.length - 1; i >= 0; i--) {
      this.waters[i].timer -= dt;
      if (this.waters[i].timer <= 0) this.waters.splice(i, 1);
    }

    // 지연 아이템 등장
    for (let i = this.pendingItems.length - 1; i >= 0; i--) {
      const pi = this.pendingItems[i];
      pi.delay -= dt;
      if (pi.delay <= 0) {
        this.pendingItems.splice(i, 1);
        if (this.grid[pi.gy][pi.gx] === T_EMPTY && !this.items.some((it) => it.gx === pi.gx && it.gy === pi.gy)) {
          this.items.push({ gx: pi.gx, gy: pi.gy, type: pi.type });
        }
      }
    }

    // 플레이어 상태 처리
    for (const p of this.players) {
      if (p.state === ST_DEAD) continue;
      p.immuneTimer = Math.max(0, p.immuneTimer - dt);

      // 물줄기 피격 → 갇힘
      if (p.state === ST_ALIVE && p.immuneTimer <= 0 && this.waterAt(p.gx, p.gy)) {
        p.state = ST_TRAPPED;
        p.trapTimer = TRAP_DURATION;
        sfx.trap();
        // AI는 일정 확률로 바늘 보유 시 즉시 사용하지 않고 약간 버틴다 (ai.js에서 처리)
      }

      // 갇힘 타이머
      if (p.state === ST_TRAPPED) {
        p.trapTimer -= dt;
        if (p.trapTimer <= 0) {
          this.killPlayer(p);
          continue;
        }
        // 적 접촉 → 즉사 (FFA: 모두가 적)
        for (const o of this.players) {
          if (o === p || o.state !== ST_ALIVE) continue;
          const d = Math.hypot(o.px - p.px, o.py - p.py);
          if (d < TILE * 0.7) {
            this.killPlayer(p);
            break;
          }
        }
        continue;
      }

      // 아이템 획득
      const itIdx = this.items.findIndex((it) => it.gx === p.gx && it.gy === p.gy);
      if (itIdx >= 0 && p.state === ST_ALIVE) {
        this.applyItem(p, this.items[itIdx].type);
        this.items.splice(itIdx, 1);
      }
    }

    // 이펙트
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].timer -= dt;
      if (this.effects[i].timer <= 0) this.effects.splice(i, 1);
    }

    // 승패 판정 (1초 유예)
    const survivors = this.players.filter((p) => p.state !== ST_DEAD);
    if (survivors.length <= 1) {
      this.resultDelay += dt;
      if (this.resultDelay > 1.0) {
        if (survivors.length === 0) this.endRound('draw');
        else this.endRound(survivors[0].isHuman ? 'win' : 'lose');
      }
    } else {
      this.resultDelay = 0;
    }
  }

  killPlayer(p) {
    if (p.state === ST_DEAD) return;
    p.state = ST_DEAD;
    this.effects.push({ type: 'splash', x: p.px, y: p.py, timer: 0.6 });
    sfx.die();
  }

  endRound(result) {
    if (this.over) return;
    this.over = true;
    this.result = result;
    if (result === 'win') sfx.win();
    else if (result === 'lose') sfx.lose();
  }
}

function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  if (value > target) return Math.max(target, value - step);
  return value;
}
