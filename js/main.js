// 메인 — 화면 상태 머신(타이틀/캐릭터 선택/인게임/결과), 입력, 렌더링

import {
  TILE, COLS, ROWS, HUD_H, CANVAS_W, CANVAS_H,
  T_SOLID, T_BOX,
  ST_ALIVE, ST_TRAPPED, ST_DEAD,
  CHARACTERS, ROUND_TIME,
} from './constants.js';
import { loadSprites } from './sprites.js';
import { Game, tileCenter } from './game.js';
import { unlockAudio, sfx, startBgm, stopBgm, toggleMute, isMuted } from './sound.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

function fitCanvas() {
  const scale = Math.min(
    window.innerWidth / CANVAS_W,
    window.innerHeight / CANVAS_H,
    1.4
  );
  canvas.style.width = CANVAS_W * scale + 'px';
  canvas.style.height = CANVAS_H * scale + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const sprites = loadSprites();

// ---------- 상태 ----------

let screen = 'title';   // title | select | playing | result
let game = null;
let selectedChar = 0;
let globalTime = 0;

const input = {
  dir: null,
  action: false,
  dirStack: [],   // 마지막에 누른 방향 우선
};

const KEY_DIR = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.repeat) return;

  if (e.code === 'KeyM') { toggleMute(); return; }

  if (screen === 'title') {
    if (e.code === 'Space' || e.code === 'Enter') {
      sfx.select();
      screen = 'select';
    }
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
    if (e.code === 'Space' || e.code === 'Enter') {
      sfx.select();
      screen = 'select';
    } else if (e.code === 'Escape') {
      backToTitle();
    }
  }
});

window.addEventListener('keyup', (e) => {
  const dir = KEY_DIR[e.code];
  if (dir) {
    input.dirStack = input.dirStack.filter((d) => d !== dir);
    input.dir = input.dirStack[input.dirStack.length - 1] || null;
  }
});

// 클릭/터치로도 진행 가능 (모바일 최소 지원)
canvas.addEventListener('pointerdown', () => {
  unlockAudio();
  if (screen === 'title') { sfx.select(); screen = 'select'; }
  else if (screen === 'result') { sfx.select(); screen = 'select'; }
});

function startGame() {
  game = new Game(selectedChar);
  screen = 'playing';
  input.dir = null;
  input.dirStack = [];
  input.action = false;
  sfx.start();
  startBgm();
}

function backToTitle() {
  screen = 'title';
  game = null;
  stopBgm();
}

// ---------- 렌더링 ----------

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (screen === 'title') drawTitle();
  else if (screen === 'select') drawSelect();
  else if (screen === 'playing' || screen === 'result') drawGame();

  if (screen === 'result') drawResult();
}

function drawTitle() {
  // 하늘 배경
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, '#5db8f0');
  g.addColorStop(1, '#bfe9ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 떠다니는 물방울 장식
  for (let i = 0; i < 14; i++) {
    const x = (i * 137 + globalTime * 18) % (CANVAS_W + 60) - 30;
    const y = 80 + ((i * 89) % (CANVAS_H - 160)) + Math.sin(globalTime * 1.5 + i) * 12;
    const r = 8 + (i % 4) * 5;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // 로고
  ctx.save();
  ctx.translate(CANVAS_W / 2, 180 + Math.sin(globalTime * 2) * 6);
  ctx.textAlign = 'center';
  ctx.font = '900 64px "Malgun Gothic", sans-serif';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#1a5fa8';
  ctx.strokeText('스플래시', 0, 0);
  ctx.strokeText('아케이드', 0, 70);
  const lg = ctx.createLinearGradient(0, -50, 0, 80);
  lg.addColorStop(0, '#ffe14d');
  lg.addColorStop(0.5, '#ffb94d');
  lg.addColorStop(1, '#ff8a3d');
  ctx.fillStyle = lg;
  ctx.fillText('스플래시', 0, 0);
  ctx.fillText('아케이드', 0, 70);
  ctx.restore();

  // 캐릭터 행진
  for (let i = 0; i < CHARACTERS.length; i++) {
    const ch = CHARACTERS[i];
    const frame = Math.floor(globalTime * 6 + i) % 2;
    const x = CANVAS_W / 2 - 150 + i * 100;
    const y = 360 + Math.sin(globalTime * 4 + i * 1.3) * 4;
    ctx.drawImage(sprites.chars[ch.id].down[frame], x - TILE / 2, y);
  }

  // 안내
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px "Malgun Gothic", sans-serif';
  ctx.fillStyle = Math.sin(globalTime * 5) > -0.2 ? '#fff' : 'rgba(255,255,255,0.25)';
  ctx.fillText('SPACE 키를 눌러 시작', CANVAS_W / 2, 500);

  ctx.font = '15px "Malgun Gothic", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('이동: 방향키/WASD · 물풍선: SPACE · 음소거: M', CANVAS_W / 2, 560);
  ctx.fillText('물풍선으로 상대를 가두고 터뜨려 최후의 1인이 되세요!', CANVAS_W / 2, 585);
  ctx.font = '12px "Malgun Gothic", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('팬 메이드 오리지널 게임 · 모든 에셋은 자체 제작되었습니다', CANVAS_W / 2, 645);
}

function drawSelect() {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, '#4aa8e8');
  g.addColorStop(1, '#a8ddff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.textAlign = 'center';
  ctx.font = '900 40px "Malgun Gothic", sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a5fa8';
  ctx.strokeText('캐릭터 선택', CANVAS_W / 2, 110);
  ctx.fillStyle = '#fff';
  ctx.fillText('캐릭터 선택', CANVAS_W / 2, 110);

  const cardW = 130, cardH = 190;
  const startX = CANVAS_W / 2 - (CHARACTERS.length * (cardW + 20) - 20) / 2;

  for (let i = 0; i < CHARACTERS.length; i++) {
    const ch = CHARACTERS[i];
    const x = startX + i * (cardW + 20);
    const y = 200;
    const selected = i === selectedChar;

    ctx.save();
    if (selected) {
      ctx.translate(x + cardW / 2, y + cardH / 2);
      ctx.scale(1.08, 1.08);
      ctx.translate(-(x + cardW / 2), -(y + cardH / 2));
    }
    // 카드
    ctx.fillStyle = selected ? '#fff' : 'rgba(255,255,255,0.55)';
    roundRect(x, y, cardW, cardH, 16);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#ffb94d';
      ctx.lineWidth = 5;
      roundRect(x, y, cardW, cardH, 16);
      ctx.stroke();
    }
    // 캐릭터
    const frame = selected ? Math.floor(globalTime * 6) % 2 : 0;
    ctx.drawImage(
      sprites.chars[ch.id].down[frame],
      x + cardW / 2 - TILE / 2, y + 30, TILE, TILE + 12
    );
    // 이름
    ctx.font = 'bold 22px "Malgun Gothic", sans-serif';
    ctx.fillStyle = selected ? '#e8731a' : '#456';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, x + cardW / 2, y + 135);
    const species = { cat: '고양이', dog: '강아지', penguin: '펭귄', rabbit: '토끼' }[ch.species];
    ctx.font = '14px "Malgun Gothic", sans-serif';
    ctx.fillStyle = '#789';
    ctx.fillText(species, x + cardW / 2, y + 160);
    ctx.restore();
  }

  ctx.font = 'bold 22px "Malgun Gothic", sans-serif';
  ctx.fillStyle = Math.sin(globalTime * 5) > -0.2 ? '#fff' : 'rgba(255,255,255,0.3)';
  ctx.fillText('← → 로 선택, SPACE 로 게임 시작', CANVAS_W / 2, 480);

  ctx.font = '15px "Malgun Gothic", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('AI 봇 3명과 서바이벌 대결! 마지막까지 살아남으세요.', CANVAS_W / 2, 530);
}

function drawGame() {
  if (!game) return;

  // HUD
  drawHud();

  ctx.save();
  ctx.translate(0, HUD_H);

  // 화면 흔들림
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  }

  // 바닥
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.drawImage(sprites.ground[(x + y) % 2], x * TILE, y * TILE);
    }
  }

  // 아이템
  for (const it of game.items) {
    const bob = Math.sin(globalTime * 4 + it.gx + it.gy) * 2;
    ctx.drawImage(sprites.items[it.type], it.gx * TILE, it.gy * TILE + bob);
  }

  // 블록
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = game.grid[y][x];
      if (t === T_SOLID) ctx.drawImage(sprites.solid, x * TILE, y * TILE);
      else if (t === T_BOX) ctx.drawImage(sprites.box, x * TILE, y * TILE);
    }
  }

  // 물풍선
  for (const b of game.balloons) {
    const urgent = b.timer < 1.0;
    const speed = urgent ? 14 : 7;
    const frame = Math.floor(b.anim * speed) % 3;
    const pulse = urgent ? 1 + Math.sin(b.anim * 20) * 0.06 : 1;
    const size = TILE * pulse;
    ctx.drawImage(
      sprites.balloon[frame],
      b.gx * TILE + (TILE - size) / 2,
      b.gy * TILE + (TILE - size) / 2,
      size, size
    );
  }

  // 물줄기
  for (const w of game.waters) {
    const alpha = Math.min(1, w.timer / 0.15);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprites.water[w.kind], w.gx * TILE, w.gy * TILE);
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
      const frame = p.moving ? Math.floor(p.walkAnim) % 2 : 0;
      img = set[p.dir][frame];
    }
    const x = p.px - TILE / 2;
    const y = p.py - TILE / 2 - 12;

    // 무적(바늘 탈출 직후) 깜빡임
    if (p.immuneTimer > 0 && Math.floor(globalTime * 12) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    ctx.drawImage(img, x, y);
    ctx.globalAlpha = 1;

    // 갇힘 물방울 + 남은 시간 게이지
    if (p.state === ST_TRAPPED) {
      const bw = sprites.bubble.width;
      const wobble = Math.sin(globalTime * 6) * 2;
      ctx.drawImage(sprites.bubble, p.px - bw / 2, p.py - bw / 2 - 6 + wobble);
      // 게이지
      const ratio = p.trapTimer / 7;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(p.px - 16, p.py - 40, 32, 5);
      ctx.fillStyle = ratio > 0.4 ? '#4dd163' : '#e74c3c';
      ctx.fillRect(p.px - 16, p.py - 40, 32 * ratio, 5);
    }

    // 이름표 (사람 플레이어 강조)
    ctx.font = 'bold 11px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(p.name, p.px + 1, p.py - 27);
    ctx.fillStyle = p.isHuman ? '#ffe14d' : '#fff';
    ctx.fillText(p.name, p.px, p.py - 28);
  }

  // 이펙트
  for (const ef of game.effects) {
    if (ef.type === 'boxBreak') {
      const t = 1 - ef.timer / 0.4;
      ctx.fillStyle = `rgba(86, 204, 102, ${1 - t})`;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const d = t * 24;
        ctx.beginPath();
        ctx.arc(ef.x + Math.cos(a) * d, ef.y + Math.sin(a) * d - t * 10, 4 * (1 - t), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ef.type === 'splash' || ef.type === 'popBubble') {
      const dur = ef.type === 'splash' ? 0.6 : 0.3;
      const t = 1 - ef.timer / dur;
      ctx.strokeStyle = `rgba(120, 200, 250, ${1 - t})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, t * 36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(170, 225, 255, ${1 - t})`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        const d = t * 30;
        ctx.beginPath();
        ctx.arc(ef.x + Math.cos(a) * d, ef.y + Math.sin(a) * d, 3.5 * (1 - t), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ef.type === 'sparkle') {
      const t = 1 - ef.timer / 0.5;
      ctx.fillStyle = `rgba(255, 225, 77, ${1 - t})`;
      ctx.font = `${16 + t * 8}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('✦', ef.x, ef.y - t * 20);
    }
  }

  ctx.restore();
}

function drawHud() {
  const g = ctx.createLinearGradient(0, 0, 0, HUD_H);
  g.addColorStop(0, '#1a5fa8');
  g.addColorStop(1, '#15497e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);

  const human = game.human;

  // 시간
  const t = Math.max(0, Math.ceil(game.time));
  const min = Math.floor(t / 60);
  const sec = String(t % 60).padStart(2, '0');
  ctx.font = '900 30px "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = t <= 10 ? '#ff6b5e' : '#fff';
  ctx.fillText(`${min}:${sec}`, CANVAS_W / 2, 42);

  // 능력치 (좌측)
  ctx.font = 'bold 17px "Malgun Gothic", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe14d';
  const statY = 40;
  ctx.fillText(`💧×${human.maxBalloons}`, 16, statY);
  ctx.fillText(`🌊×${human.streamLen}`, 100, statY);
  ctx.fillText(`👟×${human.speed}`, 184, statY);
  ctx.fillText(`📍×${human.needles}`, 262, statY);

  // 생존자 수 (우측)
  const alive = game.players.filter((p) => p.state !== ST_DEAD).length;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.fillText(`생존 ${alive}/4`, CANVAS_W - 16, 40);

  // 음소거 표시
  if (isMuted()) {
    ctx.font = '13px "Malgun Gothic", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('🔇', CANVAS_W - 110, 40);
  }
}

function drawResult() {
  ctx.fillStyle = 'rgba(10, 30, 60, 0.65)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const msg = game.result === 'win' ? '🎉 승리!' : game.result === 'lose' ? '😢 패배...' : '⏰ 무승부';
  const sub = game.result === 'win'
    ? '최후의 1인이 되었습니다!'
    : game.result === 'lose'
      ? '다음엔 꼭 이길 수 있어요!'
      : '시간이 다 되었습니다.';

  ctx.textAlign = 'center';
  ctx.font = '900 60px "Malgun Gothic", sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#1a5fa8';
  ctx.strokeText(msg, CANVAS_W / 2, CANVAS_H / 2 - 40);
  ctx.fillStyle = game.result === 'win' ? '#ffe14d' : '#fff';
  ctx.fillText(msg, CANVAS_W / 2, CANVAS_H / 2 - 40);

  ctx.font = '22px "Malgun Gothic", sans-serif';
  ctx.fillStyle = '#dbeeff';
  ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 16);

  ctx.font = 'bold 22px "Malgun Gothic", sans-serif';
  ctx.fillStyle = Math.sin(globalTime * 5) > -0.2 ? '#fff' : 'rgba(255,255,255,0.3)';
  ctx.fillText('SPACE: 다시 하기 · ESC: 타이틀로', CANVAS_W / 2, CANVAS_H / 2 + 80);
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

// ---------- 게임 루프 ----------

// 테스트용: ?autostart=1 로 접속하면 곧바로 게임 시작, ?screen=select 로 선택 화면
const params = new URLSearchParams(location.search);
if (params.get('autostart')) {
  selectedChar = Number(params.get('char') || 0) % CHARACTERS.length;
  startGame();
} else if (params.get('screen') === 'select') {
  screen = 'select';
}

let lastTime = performance.now();

function loop(now) {
  // rAF 첫 타임스탬프가 lastTime보다 과거일 수 있으므로 음수 dt 방지
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  globalTime += dt;

  if (screen === 'playing' && game) {
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
