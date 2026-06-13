// 메인 v2 — 16:9(1280×720) 고정 레이아웃, 데스크톱+모바일 입력, 렌더링

import {
  TILE, COLS, ROWS,
  VIEW_W, VIEW_H, BOARD_W, BOARD_H, BOARD_X, BOARD_Y,
  T_SOLID, T_BOX,
  ST_ALIVE, ST_TRAPPED, ST_DEAD,
  CHARACTERS, TRAP_DURATION,
} from './constants.js';
import { loadSprites, SS } from './sprites.js';
import { Game } from './game.js';
import { unlockAudio, sfx, startBgm, stopBgm, toggleMute, isMuted } from './sound.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// DPR 대응 (최대 2배) — 모바일에서 선명하게
const DPR = Math.min(2, window.devicePixelRatio || 1);
canvas.width = VIEW_W * DPR;
canvas.height = VIEW_H * DPR;
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = Math.floor(VIEW_W * scale) + 'px';
  canvas.style.height = Math.floor(VIEW_H * scale) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const sprites = loadSprites();

// 논리 크기로 스프라이트 그리기 (SS 배율 보정)
function blit(img, x, y, w, h) {
  ctx.drawImage(img, x, y, w ?? img.width / SS, h ?? img.height / SS);
}

function outlinedText(text, x, y, size, fill, stroke, strokeW, weight = '900') {
  ctx.font = `${weight} ${size}px 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`;
  ctx.textAlign = 'center';
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- 상태 ----------

let screen = 'title';   // title | select | playing | result
let game = null;
let selectedChar = 0;
let globalTime = 0;
let touchMode = false;  // 터치 입력이 감지되면 가상 컨트롤 표시

const input = { dir: null, action: false, dirStack: [] };

// 터치 조이스틱/버튼 상태
const joy = { active: false, pointerId: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
const JOY_AREA = { x: 0, y: 0, w: BOARD_X, h: VIEW_H };                 // 좌측 패널 전체
const ACT_BTN = { x: VIEW_W - 140, y: VIEW_H - 150, r: 75 };            // 우하단 버튼

// ---------- 키보드 ----------

const KEY_DIR = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.repeat) return;
  if (e.code === 'KeyM') { toggleMute(); return; }

  if (screen === 'title') {
    if (e.code === 'Space' || e.code === 'Enter') { sfx.select(); screen = 'select'; }
    return;
  }
  if (screen === 'select') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      selectedChar = (selectedChar + CHARACTERS.length - 1) % CHARACTERS.length;
      sfx.select();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      selectedChar = (selectedChar + 1) % CHARACTERS.length;
      sfx.select();
    } else if (e.code === 'Space' || e.code === 'Enter') {
      startGame();
    } else if (e.code === 'Escape') {
      screen = 'title';
    }
    return;
  }
  if (screen === 'playing') {
    const dir = KEY_DIR[e.code];
    if (dir) {
      e.preventDefault();
      if (!input.dirStack.includes(dir)) input.dirStack.push(dir);
      input.dir = dir;
    } else if (e.code === 'Space') {
      e.preventDefault();
      input.action = true;
    } else if (e.code === 'Escape') {
      backToTitle();
    }
    return;
  }
  if (screen === 'result') {
    if (e.code === 'Space' || e.code === 'Enter') { sfx.select(); startGame(); }
    else if (e.code === 'Escape') backToTitle();
  }
});

window.addEventListener('keyup', (e) => {
  const dir = KEY_DIR[e.code];
  if (dir) {
    input.dirStack = input.dirStack.filter((d) => d !== dir);
    input.dir = input.dirStack[input.dirStack.length - 1] || null;
  }
});

// ---------- 포인터(터치/마우스) ----------

function toView(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * VIEW_W,
    y: ((e.clientY - rect.top) / rect.height) * VIEW_H,
  };
}

// 화면별 버튼 영역
const BTN_SELECT_START = { x: VIEW_W / 2 - 130, y: 565, w: 260, h: 64 };
const BTN_RESULT_RETRY = { x: VIEW_W / 2 - 230, y: VIEW_H / 2 + 60, w: 210, h: 60 };
const BTN_RESULT_TITLE = { x: VIEW_W / 2 + 20, y: VIEW_H / 2 + 60, w: 210, h: 60 };

function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (e.pointerType === 'touch') touchMode = true;
  const p = toView(e);

  if (screen === 'title') {
    sfx.select();
    screen = 'select';
    return;
  }

  if (screen === 'select') {
    // 캐릭터 카드 탭
    const card = selectCardAt(p);
    if (card >= 0) {
      if (selectedChar === card) startGame();   // 같은 카드 한 번 더 → 시작
      else { selectedChar = card; sfx.select(); }
      return;
    }
    if (inRect(p, BTN_SELECT_START)) startGame();
    return;
  }

  if (screen === 'playing') {
    // 액션 버튼
    const d = Math.hypot(p.x - ACT_BTN.x, p.y - ACT_BTN.y);
    if (d <= ACT_BTN.r + 22) {
      input.action = true;
      return;
    }
    // 조이스틱 (좌측 패널 또는 화면 좌측 1/3)
    if (p.x < JOY_AREA.w + 60 && !joy.active) {
      joy.active = true;
      joy.pointerId = e.pointerId;
      joy.baseX = p.x;
      joy.baseY = p.y;
      joy.dx = 0;
      joy.dy = 0;
      canvas.setPointerCapture(e.pointerId);
    }
    return;
  }

  if (screen === 'result') {
    if (inRect(p, BTN_RESULT_RETRY)) { sfx.select(); startGame(); }
    else if (inRect(p, BTN_RESULT_TITLE)) { sfx.select(); backToTitle(); }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joy.pointerId) return;
  const p = toView(e);
  joy.dx = p.x - joy.baseX;
  joy.dy = p.y - joy.baseY;
  const len = Math.hypot(joy.dx, joy.dy);
  const max = 58;
  if (len > max) {
    joy.dx = (joy.dx / len) * max;
    joy.dy = (joy.dy / len) * max;
  }
});

function endJoy(e) {
  if (joy.active && e.pointerId === joy.pointerId) {
    joy.active = false;
    joy.dx = 0;
    joy.dy = 0;
  }
}
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 조이스틱 → 방향 (매 프레임)
function joyDir() {
  if (!joy.active) return null;
  const len = Math.hypot(joy.dx, joy.dy);
  if (len < 18) return null;
  if (Math.abs(joy.dx) > Math.abs(joy.dy)) return joy.dx > 0 ? 'right' : 'left';
  return joy.dy > 0 ? 'down' : 'up';
}

// 캐릭터 선택 카드 배치
const CARD_W = 170, CARD_H = 240, CARD_GAP = 28;
function cardX(i) {
  const total = CHARACTERS.length * (CARD_W + CARD_GAP) - CARD_GAP;
  return VIEW_W / 2 - total / 2 + i * (CARD_W + CARD_GAP);
}
const CARD_Y = 230;

function selectCardAt(p) {
  for (let i = 0; i < CHARACTERS.length; i++) {
    if (p.x >= cardX(i) && p.x <= cardX(i) + CARD_W && p.y >= CARD_Y && p.y <= CARD_Y + CARD_H) return i;
  }
  return -1;
}

function startGame() {
  game = new Game(selectedChar);
  screen = 'playing';
  input.dir = null;
  input.dirStack = [];
  input.action = false;
  joy.active = false;
  sfx.start();
  startBgm();
}

function backToTitle() {
  screen = 'title';
  game = null;
  stopBgm();
}

// ---------- 공통 배경 ----------

function drawBackdrop() {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#2a78c2');
  g.addColorStop(0.6, '#5db8f0');
  g.addColorStop(1, '#9adcff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 떠다니는 물방울
  for (let i = 0; i < 16; i++) {
    const x = (i * 173 + globalTime * 22) % (VIEW_W + 80) - 40;
    const y = 60 + ((i * 127) % (VIEW_H - 120)) + Math.sin(globalTime * 1.4 + i) * 14;
    const r = 6 + (i % 5) * 5;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- 타이틀 ----------

function drawTitle() {
  drawBackdrop();

  // 로고
  const ly = 200 + Math.sin(globalTime * 2) * 8;
  outlinedText('스플래시', VIEW_W / 2, ly, 88, '#ffd84d', '#15497e', 18);
  outlinedText('아케이드', VIEW_W / 2, ly + 92, 88, '#ff9e3d', '#15497e', 18);
  // 로고 물방울 포인트
  blit(sprites.balloon[Math.floor(globalTime * 6) % 3], VIEW_W / 2 + 248, ly - 60, 72, 72);

  // 캐릭터 행진
  for (let i = 0; i < CHARACTERS.length; i++) {
    const ch = CHARACTERS[i];
    const frame = [0, 1, 0, 2][Math.floor(globalTime * 6 + i) % 4];
    const x = VIEW_W / 2 - 230 + i * 130;
    const y = 420 + Math.sin(globalTime * 4 + i * 1.3) * 5;
    blit(sprites.chars[ch.id].down[frame], x, y, 72, 96);
  }

  const blink = Math.sin(globalTime * 5) > -0.2;
  outlinedText(touchMode ? '화면을 터치해서 시작' : 'SPACE 키를 눌러 시작', VIEW_W / 2, 600,
    30, blink ? '#fff' : 'rgba(255,255,255,0.35)', '#15497e', 8);

  ctx.font = '16px "Malgun Gothic", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('이동: 방향키/WASD 또는 가상 조이스틱 · 물풍선: SPACE 또는 버튼 · 음소거: M', VIEW_W / 2, 655);
  ctx.font = '13px "Malgun Gothic", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('팬 메이드 오리지널 게임 · 모든 에셋 자체 제작', VIEW_W / 2, 695);
}

// ---------- 캐릭터 선택 ----------

function drawSelect() {
  drawBackdrop();

  outlinedText('캐릭터 선택', VIEW_W / 2, 130, 56, '#fff', '#15497e', 12);

  for (let i = 0; i < CHARACTERS.length; i++) {
    const ch = CHARACTERS[i];
    const x = cardX(i);
    const selected = i === selectedChar;

    ctx.save();
    if (selected) {
      ctx.translate(x + CARD_W / 2, CARD_Y + CARD_H / 2);
      ctx.scale(1.07, 1.07);
      ctx.translate(-(x + CARD_W / 2), -(CARD_Y + CARD_H / 2));
    }
    roundRect(x, CARD_Y, CARD_W, CARD_H, 20);
    ctx.fillStyle = selected ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.fill();
    if (selected) {
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffb94d';
      roundRect(x, CARD_Y, CARD_W, CARD_H, 20);
      ctx.stroke();
    }
    const frame = selected ? [0, 1, 0, 2][Math.floor(globalTime * 6) % 4] : 0;
    blit(sprites.chars[ch.id].down[frame], x + CARD_W / 2 - 39, CARD_Y + 24, 78, 104);

    ctx.font = 'bold 28px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = selected ? '#e8731a' : '#456';
    ctx.fillText(ch.name, x + CARD_W / 2, CARD_Y + 172);
    const species = { cat: '고양이', dog: '강아지', penguin: '펭귄', rabbit: '토끼' }[ch.species];
    ctx.font = '17px "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#789';
    ctx.fillText(species, x + CARD_W / 2, CARD_Y + 202);
    ctx.restore();
  }

  // 시작 버튼
  const b = BTN_SELECT_START;
  roundRect(b.x, b.y, b.w, b.h, 32);
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  bg.addColorStop(0, '#ffd84d');
  bg.addColorStop(1, '#ff9e3d');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#b86a14';
  roundRect(b.x, b.y, b.w, b.h, 32);
  ctx.stroke();
  outlinedText('게임 시작!', VIEW_W / 2, b.y + 44, 30, '#fff', '#b86a14', 7);

  ctx.font = '16px "Malgun Gothic", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  ctx.fillText(touchMode ? '카드를 탭해서 선택 · 한 번 더 탭하면 시작' : '← → 로 선택, SPACE 로 시작', VIEW_W / 2, 675);
}

// ---------- 인게임 ----------

function drawGame() {
  drawBackdrop();
  drawBoardFrame();
  drawLeftPanel();
  drawRightPanel();
  drawBoard();
  if (screen === 'playing' && touchMode) drawTouchControls();
}

function drawBoardFrame() {
  // 게임판 테두리 프레임
  roundRect(BOARD_X - 10, BOARD_Y - 10, BOARD_W + 20, BOARD_H + 20, 14);
  ctx.fillStyle = '#15497e';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  roundRect(BOARD_X - 10, BOARD_Y - 10, BOARD_W + 20, BOARD_H + 20, 14);
  ctx.stroke();
}

function panelBox(x, y, w, h) {
  roundRect(x, y, w, h, 14);
  ctx.fillStyle = 'rgba(13, 52, 96, 0.78)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  roundRect(x, y, w, h, 14);
  ctx.stroke();
}

function drawLeftPanel() {
  const human = game.human;
  const px = 18, pw = BOARD_X - 46;

  // 내 캐릭터 카드
  panelBox(px, BOARD_Y - 10, pw, 250);
  blit(sprites.portraits[human.charId], px + pw / 2 - 26, BOARD_Y + 6, 52, 52);
  outlinedText(human.name, px + pw / 2, BOARD_Y + 86, 24, '#ffe14d', '#15497e', 6);

  const stats = [
    { icon: sprites.items.BALLOON, v: human.maxBalloons },
    { icon: sprites.items.POTION, v: human.streamLen },
    { icon: sprites.items.ROLLER, v: human.speed },
    { icon: sprites.items.NEEDLE, v: human.needles },
  ];
  for (let i = 0; i < stats.length; i++) {
    const sy = BOARD_Y + 104 + i * 36;
    blit(stats[i].icon, px + 22, sy, 30, 30);
    ctx.font = 'bold 20px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText('× ' + stats[i].v, px + 62, sy + 23);
  }

  // 상태 메시지
  if (human.state === ST_TRAPPED) {
    panelBox(px, BOARD_Y + 256, pw, 64);
    const blink = Math.sin(globalTime * 8) > 0;
    outlinedText(blink ? '갇혔다!' : '', px + pw / 2, BOARD_Y + 286, 20, '#ff6b5e', '#5e1410', 5);
    ctx.font = '13px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd';
    ctx.fillText(human.needles > 0 ? '버튼/SPACE로 바늘 사용!' : '바늘이 없어요...', px + pw / 2, BOARD_Y + 308);
  } else if (human.state === ST_DEAD) {
    panelBox(px, BOARD_Y + 256, pw, 50);
    outlinedText('탈락...', px + pw / 2, BOARD_Y + 290, 20, '#9fb6cc', '#15314e', 5);
  }
}

function drawRightPanel() {
  const rx = BOARD_X + BOARD_W + 28, rw = VIEW_W - rx - 18;

  // 타이머
  panelBox(rx, BOARD_Y - 10, rw, 74);
  const t = Math.max(0, Math.ceil(game.time));
  const min = Math.floor(t / 60);
  const sec = String(t % 60).padStart(2, '0');
  outlinedText(`${min}:${sec}`, rx + rw / 2, BOARD_Y + 42, 40, t <= 10 ? '#ff6b5e' : '#fff', '#15497e', 8);

  // 플레이어 현황
  panelBox(rx, BOARD_Y + 80, rw, 4 * 64 + 24);
  for (let i = 0; i < game.players.length; i++) {
    const p = game.players[i];
    const py = BOARD_Y + 96 + i * 64;
    if (p.state === ST_DEAD) ctx.globalAlpha = 0.38;
    blit(sprites.portraits[p.charId], rx + 14, py, 44, 44);
    ctx.font = 'bold 18px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = p.isHuman ? '#ffe14d' : '#fff';
    ctx.fillText(p.name + (p.isHuman ? ' (나)' : ''), rx + 68, py + 20);
    ctx.font = '14px "Malgun Gothic", sans-serif';
    ctx.fillStyle = p.state === ST_DEAD ? '#9fb6cc' : p.state === ST_TRAPPED ? '#7cc4f5' : '#7de08a';
    ctx.fillText(p.state === ST_DEAD ? '탈락' : p.state === ST_TRAPPED ? '갇힘!' : '생존', rx + 68, py + 42);
    ctx.globalAlpha = 1;
  }

  // 음소거 안내
  ctx.font = '13px "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(isMuted() ? '🔇 음소거 (M)' : '🔊 사운드 (M)', rx + rw / 2, BOARD_Y + 380);
}

function drawBoard() {
  ctx.save();

  // 게임판 영역 클리핑 + 흔들림
  roundRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 6);
  ctx.clip();
  let ox = BOARD_X, oy = BOARD_Y;
  if (game.shake > 0) {
    ox += (Math.random() - 0.5) * 7;
    oy += (Math.random() - 0.5) * 7;
  }
  ctx.translate(ox, oy);

  // 바닥
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      blit(sprites.ground[(x + y) % 2], x * TILE, y * TILE, TILE, TILE);
    }
  }

  // 아이템
  for (const it of game.items) {
    const bob = Math.sin(globalTime * 4 + it.gx + it.gy) * 2.5;
    blit(sprites.items[it.type], it.gx * TILE, it.gy * TILE + bob, TILE, TILE);
  }

  // 블록
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = game.grid[y][x];
      if (t === T_SOLID) blit(sprites.solid, x * TILE, y * TILE, TILE, TILE);
      else if (t === T_BOX) blit(sprites.box, x * TILE, y * TILE, TILE, TILE);
    }
  }

  // 물풍선
  for (const b of game.balloons) {
    const urgent = b.timer < 1.0;
    const speed = urgent ? 14 : 7;
    const frame = Math.floor(b.anim * speed) % 3;
    const pulse = urgent ? 1 + Math.sin(b.anim * 20) * 0.07 : 1;
    const size = TILE * pulse;
    blit(sprites.balloon[frame], b.gx * TILE + (TILE - size) / 2, b.gy * TILE + (TILE - size) / 2, size, size);
  }

  // 물줄기
  for (const w of game.waters) {
    ctx.globalAlpha = Math.min(1, w.timer / 0.12);
    blit(sprites.water[w.kind], w.gx * TILE, w.gy * TILE, TILE, TILE);
    ctx.globalAlpha = 1;
  }

  // 플레이어 (y 정렬)
  const sorted = [...game.players].sort((a, b) => a.py - b.py);
  for (const p of sorted) {
    if (p.state === ST_DEAD) continue;
    const set = sprites.chars[p.charId];
    let img;
    if (p.state === ST_TRAPPED) {
      img = set.trapped;
    } else {
      const frame = p.moving ? [0, 1, 0, 2][Math.floor(p.walkAnim) % 4] : 0;
      img = set[p.dir][frame];
    }
    const x = p.px - 24;
    const y = p.py - 40;

    if (p.immuneTimer > 0 && Math.floor(globalTime * 12) % 2 === 0) ctx.globalAlpha = 0.4;
    blit(img, x, y, 48, 64);
    ctx.globalAlpha = 1;

    if (p.state === ST_TRAPPED) {
      const wobble = Math.sin(globalTime * 6) * 2;
      blit(sprites.bubble, p.px - 34, p.py - 34 - 4 + wobble, 68, 68);
      const ratio = Math.max(0, p.trapTimer / TRAP_DURATION);
      roundRect(p.px - 17, p.py - 47, 34, 7, 3.5);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      roundRect(p.px - 16, p.py - 46, 32 * ratio, 5, 2.5);
      ctx.fillStyle = ratio > 0.4 ? '#4dd163' : '#e74c3c';
      ctx.fill();
    }

    outlinedText(p.name, p.px, p.py - 50, 13, p.isHuman ? '#ffe14d' : '#fff', 'rgba(0,0,0,0.55)', 3.5, 'bold');
  }

  // 이펙트
  for (const ef of game.effects) {
    if (ef.type === 'boxBreak') {
      const t = 1 - ef.timer / 0.4;
      ctx.globalAlpha = 1 - t;
      // 나무 판자 파편
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        const d = t * 28;
        ctx.save();
        ctx.translate(ef.x + Math.cos(a) * d, ef.y + Math.sin(a) * d - t * 14);
        ctx.rotate(a + t * 4);
        ctx.fillStyle = i % 2 ? '#e8b46a' : '#c98e4f';
        ctx.fillRect(-5, -2.5, 10, 5);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else if (ef.type === 'splash' || ef.type === 'popBubble') {
      const dur = ef.type === 'splash' ? 0.6 : 0.3;
      const t = 1 - ef.timer / dur;
      ctx.strokeStyle = `rgba(120, 200, 250, ${1 - t})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, t * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(170, 225, 255, ${1 - t})`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        const d = t * 34;
        ctx.beginPath();
        ctx.arc(ef.x + Math.cos(a) * d, ef.y + Math.sin(a) * d, 4 * (1 - t), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ef.type === 'sparkle') {
      const t = 1 - ef.timer / 0.5;
      ctx.fillStyle = `rgba(255, 225, 77, ${1 - t})`;
      ctx.font = `${18 + t * 10}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('✦', ef.x, ef.y - t * 24);
    }
  }

  ctx.restore();
}

function drawTouchControls() {
  // 조이스틱
  const baseX = joy.active ? joy.baseX : 140;
  const baseY = joy.active ? joy.baseY : VIEW_H - 150;
  ctx.globalAlpha = joy.active ? 0.95 : 0.55;
  blit(sprites.touch.base, baseX - 80, baseY - 80, 160, 160);
  blit(sprites.touch.knob, baseX + joy.dx - 38, baseY + joy.dy - 38, 76, 76);
  ctx.globalAlpha = 1;

  // 액션 버튼
  ctx.globalAlpha = 0.92;
  blit(sprites.touch.btn, ACT_BTN.x - 75, ACT_BTN.y - 75, 150, 150);
  ctx.globalAlpha = 1;
  // 갇혔을 때 바늘 안내
  if (game.human.state === ST_TRAPPED && game.human.needles > 0) {
    outlinedText('바늘!', ACT_BTN.x, ACT_BTN.y - 90, 22, '#ffe14d', '#15497e', 6);
  }
}

// ---------- 결과 ----------

function drawResult() {
  ctx.fillStyle = 'rgba(8, 28, 56, 0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const msg = game.result === 'win' ? '승리!' : game.result === 'lose' ? '패배...' : '무승부';
  const color = game.result === 'win' ? '#ffe14d' : game.result === 'lose' ? '#cfe2f5' : '#fff';
  const sub = game.result === 'win'
    ? '최후의 1인이 되었습니다!'
    : game.result === 'lose'
      ? '다음엔 꼭 이길 수 있어요!'
      : '시간이 다 되었습니다.';

  // 승리 캐릭터 출력
  if (game.result === 'win') {
    const frame = [0, 1, 0, 2][Math.floor(globalTime * 6) % 4];
    blit(sprites.chars[game.human.charId].down[frame], VIEW_W / 2 - 48, VIEW_H / 2 - 250, 96, 128);
  }

  outlinedText(msg, VIEW_W / 2, VIEW_H / 2 - 50, 84, color, '#15497e', 16);
  ctx.font = '24px "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#dbeeff';
  ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 10);

  // 버튼
  for (const [btn, label, grad] of [
    [BTN_RESULT_RETRY, '다시 하기', ['#ffd84d', '#ff9e3d']],
    [BTN_RESULT_TITLE, '타이틀로', ['#8fd0f7', '#3d9ce0']],
  ]) {
    roundRect(btn.x, btn.y, btn.w, btn.h, 30);
    const g = ctx.createLinearGradient(0, btn.y, 0, btn.y + btn.h);
    g.addColorStop(0, grad[0]);
    g.addColorStop(1, grad[1]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    roundRect(btn.x, btn.y, btn.w, btn.h, 30);
    ctx.stroke();
    outlinedText(label, btn.x + btn.w / 2, btn.y + 40, 26, '#fff', 'rgba(20,60,110,0.8)', 6);
  }
}

// ---------- 메인 그리기 ----------

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (screen === 'title') drawTitle();
  else if (screen === 'select') drawSelect();
  else if (screen === 'playing' || screen === 'result') drawGame();
  if (screen === 'result') drawResult();
}

// ---------- 루프 ----------

// 테스트용: ?autostart=1 즉시 시작, ?screen=select 선택 화면, ?touch=1 터치 UI 미리보기
const params = new URLSearchParams(location.search);
if (params.get('autostart')) {
  selectedChar = Number(params.get('char') || 0) % CHARACTERS.length;
  startGame();
} else if (params.get('screen') === 'select') {
  screen = 'select';
}
if (params.get('touch')) touchMode = true;

let lastTime = performance.now();

function loop(now) {
  // rAF 첫 타임스탬프가 lastTime보다 과거일 수 있으므로 음수 dt 방지
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  globalTime += dt;

  if (screen === 'playing' && game) {
    // 터치 조이스틱 방향 우선, 없으면 키보드 방향 스택
    input.dir = joyDir() || input.dirStack[input.dirStack.length - 1] || null;

    game.update(dt, input);
    if (game.over) {
      screen = 'result';
      stopBgm();
    }
  }

  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
