// 프로시저럴 스프라이트 — 모든 그래픽을 캔버스로 직접 그려 오프스크린에 프리렌더한다.
// 밝은 파스텔톤 + 머리 큰 SD 동물 캐릭터 스타일의 오리지널 아트.

import { TILE, CHARACTERS } from './constants.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- 바닥/블록 타일 ----------

export function renderGroundTile(shade) {
  const c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  ctx.fillStyle = shade ? '#8ed86f' : '#9be37c';
  ctx.fillRect(0, 0, TILE, TILE);
  // 잔디 결
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, 0, TILE, 3);
  ctx.fillStyle = 'rgba(0,80,0,0.07)';
  for (let i = 0; i < 5; i++) {
    const x = (i * 37 + (shade ? 13 : 5)) % (TILE - 6);
    const y = (i * 23 + (shade ? 7 : 19)) % (TILE - 8) + 4;
    ctx.fillRect(x, y, 2, 4);
  }
  return c;
}

export function renderSolidTile() {
  const c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  // 단단한 돌 블록
  ctx.fillStyle = '#7d8ba1';
  ctx.fillRect(0, 0, TILE, TILE);
  rr(ctx, 3, 3, TILE - 6, TILE - 6, 8);
  ctx.fillStyle = '#a8b6cc';
  ctx.fill();
  rr(ctx, 6, 6, TILE - 12, TILE - 16, 6);
  ctx.fillStyle = '#c3cfe0';
  ctx.fill();
  // 하이라이트와 그림자
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  rr(ctx, 8, 8, TILE - 22, 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(40,55,80,0.35)';
  ctx.fillRect(3, TILE - 8, TILE - 6, 5);
  return c;
}

export function renderBoxTile() {
  const c = makeCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  // 풀숲 덤불 (파괴 가능)
  ctx.fillStyle = 'rgba(0,60,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(TILE / 2, TILE - 6, TILE / 2 - 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  const blobs = [
    [12, 30, 11], [36, 30, 11], [24, 26, 13],
    [14, 18, 10], [34, 18, 10], [24, 13, 11],
  ];
  for (const [x, y, r] of blobs) {
    ctx.fillStyle = '#3faf4e';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y, r] of blobs) {
    ctx.fillStyle = '#56cc66';
    ctx.beginPath();
    ctx.arc(x - 1.5, y - 2, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }
  // 꽃 장식
  ctx.fillStyle = '#ffd84d';
  ctx.beginPath();
  ctx.arc(24, 20, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8fb3';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(24 + Math.cos(a) * 5.5, 20 + Math.sin(a) * 5.5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// ---------- 캐릭터 ----------
// 4방향 × 2 걷기 프레임 + 갇힘 프레임. 머리 큰 2등신 동물.

function drawCharacter(ctx, ch, dir, frame, trapped) {
  const cx = TILE / 2;
  const bob = frame === 1 ? 1.5 : 0;
  const legSwing = frame === 1 ? 4 : -4;

  ctx.save();
  ctx.translate(0, bob);

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, 44 - bob, 13, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 다리
  ctx.fillStyle = ch.body;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  if (dir === 'left' || dir === 'right') {
    rr(ctx, cx - 7 + (dir === 'right' ? legSwing * 0.4 : -legSwing * 0.4), 36, 6, 8, 3); ctx.fill();
    rr(ctx, cx + 1 - (dir === 'right' ? legSwing * 0.4 : -legSwing * 0.4), 36, 6, 8, 3); ctx.fill();
  } else {
    rr(ctx, cx - 8, 36 + (legSwing > 0 ? 1 : 0), 6, 8, 3); ctx.fill();
    rr(ctx, cx + 2, 36 + (legSwing > 0 ? 0 : 1), 6, 8, 3); ctx.fill();
  }

  // 몸통
  rr(ctx, cx - 10, 26, 20, 14, 7);
  ctx.fillStyle = ch.body;
  ctx.fill();
  // 배
  if (dir !== 'up') {
    rr(ctx, cx - 6, 29, 12, 10, 5);
    ctx.fillStyle = ch.belly;
    ctx.fill();
  }

  // 머리 (크게)
  const hy = 16;
  ctx.fillStyle = ch.body;
  ctx.beginPath();
  ctx.arc(cx, hy, 14, 0, Math.PI * 2);
  ctx.fill();

  // 귀 (종별)
  ctx.fillStyle = ch.body;
  if (ch.species === 'cat') {
    ctx.beginPath(); ctx.moveTo(cx - 13, hy - 6); ctx.lineTo(cx - 9, hy - 17); ctx.lineTo(cx - 3, hy - 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 13, hy - 6); ctx.lineTo(cx + 9, hy - 17); ctx.lineTo(cx + 3, hy - 11); ctx.fill();
    ctx.fillStyle = ch.accent;
    ctx.beginPath(); ctx.moveTo(cx - 11, hy - 8); ctx.lineTo(cx - 9, hy - 14); ctx.lineTo(cx - 5, hy - 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 11, hy - 8); ctx.lineTo(cx + 9, hy - 14); ctx.lineTo(cx + 5, hy - 10); ctx.fill();
  } else if (ch.species === 'dog') {
    ctx.beginPath(); ctx.ellipse(cx - 13, hy - 2, 5, 9, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 13, hy - 2, 5, 9, -0.4, 0, Math.PI * 2); ctx.fill();
  } else if (ch.species === 'rabbit') {
    rr(ctx, cx - 11, hy - 26, 7, 18, 3.5); ctx.fill();
    rr(ctx, cx + 4, hy - 26, 7, 18, 3.5); ctx.fill();
    ctx.fillStyle = ch.belly;
    rr(ctx, cx - 9, hy - 23, 3, 12, 1.5); ctx.fill();
    rr(ctx, cx + 6, hy - 23, 3, 12, 1.5); ctx.fill();
  }
  // 펭귄은 귀 없음

  // 얼굴
  if (dir !== 'up') {
    const fx = dir === 'left' ? -4 : dir === 'right' ? 4 : 0;
    // 펭귄 얼굴 패치
    if (ch.species === 'penguin') {
      ctx.fillStyle = ch.belly;
      ctx.beginPath();
      ctx.ellipse(cx + fx, hy + 3, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // 눈
    ctx.fillStyle = '#222';
    if (trapped) {
      // X자 우는 눈
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      for (const ex of [-5, 5]) {
        ctx.beginPath();
        ctx.moveTo(cx + fx + ex - 2.5, hy - 1); ctx.lineTo(cx + fx + ex + 2.5, hy + 4);
        ctx.moveTo(cx + fx + ex + 2.5, hy - 1); ctx.lineTo(cx + fx + ex - 2.5, hy + 4);
        ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.arc(cx + fx - 5, hy + 1, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + fx + 5, hy + 1, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + fx - 4.2, hy + 0.2, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + fx + 5.8, hy + 0.2, 1, 0, Math.PI * 2); ctx.fill();
    }
    // 볼터치
    ctx.fillStyle = 'rgba(255,120,140,0.45)';
    ctx.beginPath(); ctx.arc(cx + fx - 9, hy + 5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + fx + 9, hy + 5, 2.5, 0, Math.PI * 2); ctx.fill();
    // 입/부리
    if (ch.species === 'penguin') {
      ctx.fillStyle = ch.accent;
      ctx.beginPath();
      ctx.moveTo(cx + fx - 3, hy + 5);
      ctx.lineTo(cx + fx + 3, hy + 5);
      ctx.lineTo(cx + fx, hy + 9);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#5a3a2a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + fx, hy + 5, 3, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  } else {
    // 뒷모습: 머리 뒤 무늬
    ctx.fillStyle = ch.accent;
    ctx.beginPath();
    ctx.arc(cx, hy - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function renderCharacterSprites() {
  const sprites = {};
  for (const ch of CHARACTERS) {
    const set = {};
    for (const dir of ['down', 'up', 'left', 'right']) {
      set[dir] = [];
      for (let f = 0; f < 2; f++) {
        const c = makeCanvas(TILE, TILE + 12);
        const ctx = c.getContext('2d');
        ctx.translate(0, 12);
        drawCharacter(ctx, ch, dir, f, false);
        set[dir].push(c);
      }
    }
    // 갇힘 프레임
    const t = makeCanvas(TILE, TILE + 12);
    const tctx = t.getContext('2d');
    tctx.translate(0, 12);
    drawCharacter(tctx, ch, 'down', 0, true);
    set.trapped = t;
    sprites[ch.id] = set;
  }
  return sprites;
}

// ---------- 물풍선 ----------

export function renderBalloonFrames() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const c = makeCanvas(TILE, TILE);
    const ctx = c.getContext('2d');
    const cx = TILE / 2, cy = TILE / 2 + 2;
    const squish = f === 0 ? 0 : f === 1 ? 1.5 : -1.5;
    const rx = 17 + squish, ry = 17 - squish;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, TILE - 5, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 풍선 본체
    const grad = ctx.createRadialGradient(cx - 5, cy - 6, 3, cx, cy, rx + 2);
    grad.addColorStop(0, '#aee6ff');
    grad.addColorStop(0.55, '#4db5f5');
    grad.addColorStop(1, '#1f7fd0');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // 매듭
    ctx.fillStyle = '#1f7fd0';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - ry + 1);
    ctx.lineTo(cx + 4, cy - ry + 1);
    ctx.lineTo(cx, cy - ry - 5);
    ctx.fill();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 7, 5, 3.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    frames.push(c);
  }
  return frames;
}

// ---------- 물줄기 ----------
// 종류: center, h(가로 중간), v(세로 중간), 끝단 4방향

export function renderWaterSprites() {
  const make = (draw) => {
    const c = makeCanvas(TILE, TILE);
    draw(c.getContext('2d'));
    return c;
  };
  const W = TILE;
  const grad = (ctx, x0, y0, x1, y1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#8fdcff');
    g.addColorStop(0.5, '#3aa9f0');
    g.addColorStop(1, '#8fdcff');
    return g;
  };
  const TH = 30; // 물줄기 두께
  const off = (W - TH) / 2;

  const sprites = {};
  sprites.center = make((ctx) => {
    ctx.fillStyle = '#3aa9f0';
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, TH / 2 + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, TH / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bfeaff';
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, TH / 2 - 10, 0, Math.PI * 2);
    ctx.fill();
  });
  sprites.h = make((ctx) => {
    ctx.fillStyle = grad(ctx, 0, off, 0, off + TH);
    ctx.fillRect(0, off, W, TH);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(0, off + 6, W, 7);
  });
  sprites.v = make((ctx) => {
    ctx.fillStyle = grad(ctx, off, 0, off + TH, 0);
    ctx.fillRect(off, 0, TH, W);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(off + 6, 0, 7, W);
  });
  const endCap = (rot) => make((ctx) => {
    ctx.translate(W / 2, W / 2);
    ctx.rotate(rot);
    ctx.translate(-W / 2, -W / 2);
    // 오른쪽 끝단 모양 기준
    ctx.fillStyle = grad(ctx, 0, off, 0, off + TH);
    ctx.beginPath();
    ctx.moveTo(0, off);
    ctx.lineTo(W - 18, off);
    ctx.quadraticCurveTo(W - 4, W / 2, W - 18, off + TH);
    ctx.lineTo(0, off + TH);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(0, off + 6, W - 20, 7);
    // 물방울 튐
    ctx.fillStyle = '#8fdcff';
    ctx.beginPath(); ctx.arc(W - 8, off + 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W - 5, W / 2 + 6, 2.5, 0, Math.PI * 2); ctx.fill();
  });
  sprites.right = endCap(0);
  sprites.down = endCap(Math.PI / 2);
  sprites.left = endCap(Math.PI);
  sprites.up = endCap(-Math.PI / 2);
  return sprites;
}

// ---------- 갇힘 물방울 ----------

export function renderBubble() {
  const c = makeCanvas(TILE + 16, TILE + 16);
  const ctx = c.getContext('2d');
  const cx = (TILE + 16) / 2, cy = (TILE + 16) / 2;
  const r = TILE / 2 + 5;
  const g = ctx.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, r);
  g.addColorStop(0, 'rgba(220,245,255,0.55)');
  g.addColorStop(0.7, 'rgba(120,200,250,0.35)');
  g.addColorStop(1, 'rgba(60,150,230,0.55)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(cx - 9, cy - 11, 6, 4, -0.6, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// ---------- 아이템 ----------

export function renderItemSprites() {
  const make = (draw) => {
    const c = makeCanvas(TILE, TILE);
    const ctx = c.getContext('2d');
    const cx = TILE / 2, cy = TILE / 2;
    // 공통: 흰 원형 배경 + 테두리
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, TILE - 6, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffb94d';
    ctx.lineWidth = 3;
    ctx.stroke();
    draw(ctx, cx, cy);
    return c;
  };

  return {
    BALLOON: make((ctx, cx, cy) => {
      const g = ctx.createRadialGradient(cx - 3, cy - 4, 2, cx, cy, 11);
      g.addColorStop(0, '#aee6ff');
      g.addColorStop(1, '#1f7fd0');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, 9, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f7fd0';
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 9); ctx.lineTo(cx + 3, cy - 9); ctx.lineTo(cx, cy - 13);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(cx - 3.5, cy - 3, 3, 2, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }),
    POTION: make((ctx, cx, cy) => {
      // 파란 물약병
      ctx.fillStyle = '#2d8fe0';
      rr(ctx, cx - 7, cy - 4, 14, 14, 5);
      ctx.fill();
      ctx.fillStyle = '#7cc4f5';
      rr(ctx, cx - 4, cy - 1, 5, 8, 2.5);
      ctx.fill();
      ctx.fillStyle = '#b07d4f';
      rr(ctx, cx - 3, cy - 12, 6, 8, 2);
      ctx.fill();
      ctx.fillStyle = '#8a5f38';
      ctx.fillRect(cx - 3, cy - 12, 6, 3);
    }),
    ROLLER: make((ctx, cx, cy) => {
      // 롤러스케이트
      ctx.fillStyle = '#e74c3c';
      rr(ctx, cx - 10, cy - 8, 14, 12, 5);
      ctx.fill();
      rr(ctx, cx - 10, cy - 1, 20, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 7, cy - 5, 8, 2);
      ctx.fillStyle = '#f8d448';
      ctx.beginPath(); ctx.arc(cx - 5, cy + 8, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5, cy + 8, 3.5, 0, Math.PI * 2); ctx.fill();
    }),
    NEEDLE: make((ctx, cx, cy) => {
      // 바늘
      ctx.strokeStyle = '#9aa7b8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy + 9);
      ctx.lineTo(cx + 7, cy - 7);
      ctx.stroke();
      ctx.fillStyle = '#6f7d90';
      ctx.beginPath();
      ctx.moveTo(cx + 11, cy - 11);
      ctx.lineTo(cx + 4, cy - 8);
      ctx.lineTo(cx + 8, cy - 4);
      ctx.fill();
      ctx.strokeStyle = '#6f7d90';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 10, cy + 10, 3, 0, Math.PI * 2);
      ctx.stroke();
    }),
    ULTRA: make((ctx, cx, cy) => {
      // 빨간 울트라 물약
      ctx.fillStyle = '#e0452d';
      rr(ctx, cx - 7, cy - 4, 14, 14, 5);
      ctx.fill();
      ctx.fillStyle = '#f59a7c';
      rr(ctx, cx - 4, cy - 1, 5, 8, 2.5);
      ctx.fill();
      ctx.fillStyle = '#b07d4f';
      rr(ctx, cx - 3, cy - 12, 6, 8, 2);
      ctx.fill();
      // 별 표시
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', cx, cy + 7);
    }),
    DEVIL: make((ctx, cx, cy) => {
      // 빨간 악마 얼굴
      ctx.fillStyle = '#e0452d';
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 10, 0, Math.PI * 2);
      ctx.fill();
      // 뿔
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - 4); ctx.lineTo(cx - 12, cy - 13); ctx.lineTo(cx - 4, cy - 9); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 9, cy - 4); ctx.lineTo(cx + 12, cy - 13); ctx.lineTo(cx + 4, cy - 9); ctx.fill();
      // 눈
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 4, cy, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, cy, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(cx - 4, cy, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, cy, 1.2, 0, Math.PI * 2); ctx.fill();
      // 입
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy + 4, 4, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }),
  };
}

// ---------- 전체 로드 ----------

export function loadSprites() {
  return {
    ground: [renderGroundTile(false), renderGroundTile(true)],
    solid: renderSolidTile(),
    box: renderBoxTile(),
    chars: renderCharacterSprites(),
    balloon: renderBalloonFrames(),
    water: renderWaterSprites(),
    bubble: renderBubble(),
    items: renderItemSprites(),
  };
}
