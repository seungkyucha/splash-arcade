// 프로시저럴 스프라이트 v2 — 카툰 외곽선 + 2배 슈퍼샘플링.
// 모든 그래픽은 코드로 직접 그린 오리지널 아트다. (외부 에셋 미사용)

import { TILE, CHARACTERS } from './constants.js';

export const SS = 2; // 슈퍼샘플링 배율 (논리 크기 × SS 해상도로 프리렌더)

const OUTLINE = '#3a2a1e';        // 공통 카툰 외곽선
const OUT_W = 2.6;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * SS;
  c.height = h * SS;
  const ctx = c.getContext('2d');
  ctx.scale(SS, SS);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
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

// 채우기 + 카툰 외곽선
function fs(ctx, fill, lw = OUT_W, stroke = OUTLINE) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

// ---------- 바닥 타일 ----------

export function renderGroundTile(shade) {
  const [c, ctx] = makeCanvas(TILE, TILE);
  ctx.fillStyle = shade ? '#9fd96f' : '#aee382';
  ctx.fillRect(0, 0, TILE, TILE);
  // 부드러운 체커 경계
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, TILE, 2);
  ctx.fillRect(0, 0, 2, TILE);
  // 잔디 점무늬
  ctx.fillStyle = 'rgba(70,140,40,0.18)';
  const pts = shade ? [[10, 12], [30, 26], [40, 9], [18, 38]] : [[36, 14], [12, 28], [26, 42], [42, 34]];
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// ---------- 고정 블록 (돌) ----------

export function renderSolidTile() {
  const [c, ctx] = makeCanvas(TILE, TILE);
  // 바닥 그림자
  ctx.fillStyle = 'rgba(40,70,30,0.35)';
  rr(ctx, 2, 6, TILE - 4, TILE - 8, 9);
  ctx.fill();
  // 본체
  rr(ctx, 2, 2, TILE - 4, TILE - 8, 9);
  fs(ctx, '#aebdd4');
  // 윗면
  rr(ctx, 6, 6, TILE - 12, 16, 6);
  ctx.fillStyle = '#dde7f5';
  ctx.fill();
  // 아랫면 음영
  ctx.fillStyle = 'rgba(70,90,130,0.45)';
  rr(ctx, 6, TILE - 16, TILE - 12, 8, 5);
  ctx.fill();
  // 리벳
  ctx.fillStyle = '#7f93b5';
  for (const [x, y] of [[10, 11], [TILE - 10, 11], [10, TILE - 13], [TILE - 10, TILE - 13]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// ---------- 파괴 가능 블록 (나무 상자) ----------

export function renderBoxTile() {
  const [c, ctx] = makeCanvas(TILE, TILE);
  // 그림자
  ctx.fillStyle = 'rgba(40,70,30,0.3)';
  rr(ctx, 3, 7, TILE - 6, TILE - 9, 7);
  ctx.fill();
  // 상자 본체
  rr(ctx, 3, 3, TILE - 6, TILE - 8, 7);
  fs(ctx, '#e8b46a');
  // 윗면 하이라이트
  rr(ctx, 7, 7, TILE - 14, 10, 4);
  ctx.fillStyle = '#f6cf90';
  ctx.fill();
  // 가로 판자 라인
  ctx.strokeStyle = 'rgba(140,90,40,0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(6, 20); ctx.lineTo(TILE - 6, 20);
  ctx.moveTo(6, 31); ctx.lineTo(TILE - 6, 31);
  ctx.stroke();
  // 모서리 보강 띠
  ctx.fillStyle = '#c98e4f';
  rr(ctx, 3, 3, 7, TILE - 8, 4); ctx.fill();
  rr(ctx, TILE - 10, 3, 7, TILE - 8, 4); ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(120,75,30,0.6)';
  rr(ctx, 3, 3, 7, TILE - 8, 4); ctx.stroke();
  rr(ctx, TILE - 10, 3, 7, TILE - 8, 4); ctx.stroke();
  // 못
  ctx.fillStyle = '#8a5f38';
  for (const [x, y] of [[6.5, 8], [6.5, TILE - 12], [TILE - 6.5, 8], [TILE - 6.5, TILE - 12]]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // 전체 외곽선
  rr(ctx, 3, 3, TILE - 6, TILE - 8, 7);
  ctx.lineWidth = OUT_W;
  ctx.strokeStyle = '#6d4724';
  ctx.stroke();
  return c;
}

// ---------- 캐릭터 ----------
// 48×64 논리 캔버스, 발끝 y≈58. 머리 큰 2등신 + 굵은 외곽선.
// pose: 0=서있기, 1/2=걷기, 'trapped'=울상

function drawCharacter(ctx, ch, dir, pose) {
  const cx = 24;
  const trapped = pose === 'trapped';
  const step = pose === 1 ? 1 : pose === 2 ? -1 : 0;
  const bob = step !== 0 ? 1.2 : 0;

  // 그림자
  ctx.fillStyle = 'rgba(30,60,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, 59, 13, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(0, bob);

  // ----- 다리 -----
  const legY = 50;
  if (dir === 'left' || dir === 'right') {
    const f = dir === 'right' ? 1 : -1;
    rr(ctx, cx - 7 + step * 3 * f, legY, 7, 9, 3.5); fs(ctx, ch.body, 2.2);
    rr(ctx, cx + 0 - step * 3 * f, legY, 7, 9, 3.5); fs(ctx, ch.body, 2.2);
  } else {
    rr(ctx, cx - 9, legY + (step > 0 ? -1.5 : 0), 7, 9, 3.5); fs(ctx, ch.body, 2.2);
    rr(ctx, cx + 2, legY + (step < 0 ? -1.5 : 0), 7, 9, 3.5); fs(ctx, ch.body, 2.2);
  }

  // ----- 몸통 -----
  rr(ctx, cx - 11, 38, 22, 16, 8);
  fs(ctx, ch.body);
  if (dir !== 'up') {
    rr(ctx, cx - 7, 41, 14, 11, 5.5);
    ctx.fillStyle = ch.belly;
    ctx.fill();
  }

  // ----- 팔 -----
  const armY = 42;
  const armSwing = step * 2;
  ctx.beginPath(); ctx.arc(cx - 13, armY + (dir === 'left' ? armSwing : -armSwing) * 0.6, 4, 0, Math.PI * 2);
  fs(ctx, ch.body, 2.2);
  ctx.beginPath(); ctx.arc(cx + 13, armY + (dir === 'right' ? armSwing : armSwing) * 0.6, 4, 0, Math.PI * 2);
  fs(ctx, ch.body, 2.2);

  // ----- 귀 (머리 뒤에 깔리는 부분 먼저) -----
  const hy = 22;
  if (ch.species === 'cat') {
    ctx.beginPath(); ctx.moveTo(cx - 15, hy - 5); ctx.lineTo(cx - 11, hy - 20); ctx.lineTo(cx - 3, hy - 13); ctx.closePath();
    fs(ctx, ch.body, 2.2);
    ctx.beginPath(); ctx.moveTo(cx + 15, hy - 5); ctx.lineTo(cx + 11, hy - 20); ctx.lineTo(cx + 3, hy - 13); ctx.closePath();
    fs(ctx, ch.body, 2.2);
    ctx.beginPath(); ctx.moveTo(cx - 12.5, hy - 8); ctx.lineTo(cx - 10.5, hy - 16); ctx.lineTo(cx - 6, hy - 11.5); ctx.closePath();
    ctx.fillStyle = '#ffb9c8'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 12.5, hy - 8); ctx.lineTo(cx + 10.5, hy - 16); ctx.lineTo(cx + 6, hy - 11.5); ctx.closePath();
    ctx.fillStyle = '#ffb9c8'; ctx.fill();
  } else if (ch.species === 'dog') {
    ctx.beginPath(); ctx.ellipse(cx - 15, hy + 1, 5.5, 10, 0.35, 0, Math.PI * 2);
    fs(ctx, ch.accent, 2.2);
    ctx.beginPath(); ctx.ellipse(cx + 15, hy + 1, 5.5, 10, -0.35, 0, Math.PI * 2);
    fs(ctx, ch.accent, 2.2);
  } else if (ch.species === 'rabbit') {
    rr(ctx, cx - 12, hy - 30, 8, 22, 4); fs(ctx, ch.body, 2.2);
    rr(ctx, cx + 4, hy - 30, 8, 22, 4); fs(ctx, ch.body, 2.2);
    rr(ctx, cx - 9.7, hy - 26, 3.6, 14, 1.8); ctx.fillStyle = '#ffb9c8'; ctx.fill();
    rr(ctx, cx + 6.3, hy - 26, 3.6, 14, 1.8); ctx.fillStyle = '#ffb9c8'; ctx.fill();
  }

  // ----- 머리 -----
  ctx.beginPath();
  ctx.arc(cx, hy, 16, 0, Math.PI * 2);
  fs(ctx, ch.body);

  // 펭귄 헤어 뿔
  if (ch.species === 'penguin') {
    ctx.beginPath();
    ctx.moveTo(cx - 3, hy - 15); ctx.quadraticCurveTo(cx, hy - 22, cx + 5, hy - 16);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ch.body;
    ctx.stroke();
  }

  // ----- 얼굴 -----
  if (dir !== 'up') {
    const fx = dir === 'left' ? -5 : dir === 'right' ? 5 : 0;
    if (ch.species === 'penguin') {
      ctx.beginPath();
      ctx.ellipse(cx + fx, hy + 4, 10.5, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = ch.belly;
      ctx.fill();
    }
    if (trapped) {
      // X자 눈 + 우는 입
      ctx.strokeStyle = '#27201a';
      ctx.lineWidth = 2.4;
      for (const ex of [-6, 6]) {
        ctx.beginPath();
        ctx.moveTo(cx + fx + ex - 2.8, hy - 1.5); ctx.lineTo(cx + fx + ex + 2.8, hy + 4);
        ctx.moveTo(cx + fx + ex + 2.8, hy - 1.5); ctx.lineTo(cx + fx + ex - 2.8, hy + 4);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(cx + fx, hy + 8.5, 3.4, 4, 0, 0, Math.PI * 2);
      fs(ctx, '#7a3030', 1.8, '#27201a');
      // 눈물방울
      ctx.fillStyle = '#7cc4f5';
      ctx.beginPath(); ctx.arc(cx + fx - 11, hy + 5, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + fx + 11, hy + 6.5, 2, 0, Math.PI * 2); ctx.fill();
    } else {
      // 크고 반짝이는 눈
      for (const ex of [-6, 6]) {
        ctx.beginPath();
        ctx.ellipse(cx + fx + ex, hy + 1, 3.4, 4.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + fx + ex + 0.6, hy + 1.6, 2.2, 2.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#27201a';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + fx + ex - 0.6, hy + 0.2, 1, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      // 입
      if (ch.species === 'penguin') {
        ctx.beginPath();
        ctx.moveTo(cx + fx - 3.4, hy + 6);
        ctx.lineTo(cx + fx + 3.4, hy + 6);
        ctx.lineTo(cx + fx, hy + 10.5);
        ctx.closePath();
        fs(ctx, '#ffae33', 1.8, '#c47b14');
      } else {
        ctx.strokeStyle = '#5a3a2a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx + fx - 2, hy + 7, 2.4, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.arc(cx + fx + 2, hy + 7, 2.4, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
    }
    // 볼터치
    ctx.fillStyle = 'rgba(255,110,135,0.5)';
    ctx.beginPath(); ctx.ellipse(cx + fx - 11, hy + 6, 3, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + fx + 11, hy + 6, 3, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // 뒷모습 무늬
    ctx.beginPath();
    ctx.arc(cx, hy - 3, 6, 0, Math.PI * 2);
    ctx.fillStyle = ch.accent;
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
      for (const pose of [0, 1, 2]) {
        const [c, ctx] = makeCanvas(48, 64);
        drawCharacter(ctx, ch, dir, pose);
        set[dir].push(c);
      }
    }
    const [t, tctx] = makeCanvas(48, 64);
    drawCharacter(tctx, ch, 'down', 'trapped');
    set.trapped = t;
    sprites[ch.id] = set;
  }
  return sprites;
}

// HUD용 얼굴 초상화 (44×44)
export function renderPortraits() {
  const out = {};
  for (const ch of CHARACTERS) {
    const [c, ctx] = makeCanvas(44, 44);
    ctx.translate(22 - 24, 26 - 22 + 8);
    // 머리만 크게
    const cx = 24, hy = 14;
    if (ch.species === 'cat') {
      ctx.beginPath(); ctx.moveTo(cx - 15, hy - 5); ctx.lineTo(cx - 11, hy - 19); ctx.lineTo(cx - 3, hy - 13); ctx.closePath(); fs(ctx, ch.body, 2.2);
      ctx.beginPath(); ctx.moveTo(cx + 15, hy - 5); ctx.lineTo(cx + 11, hy - 19); ctx.lineTo(cx + 3, hy - 13); ctx.closePath(); fs(ctx, ch.body, 2.2);
    } else if (ch.species === 'dog') {
      ctx.beginPath(); ctx.ellipse(cx - 15, hy + 2, 5, 9, 0.35, 0, Math.PI * 2); fs(ctx, ch.accent, 2.2);
      ctx.beginPath(); ctx.ellipse(cx + 15, hy + 2, 5, 9, -0.35, 0, Math.PI * 2); fs(ctx, ch.accent, 2.2);
    } else if (ch.species === 'rabbit') {
      rr(ctx, cx - 11, hy - 24, 7, 17, 3.5); fs(ctx, ch.body, 2.2);
      rr(ctx, cx + 4, hy - 24, 7, 17, 3.5); fs(ctx, ch.body, 2.2);
    }
    ctx.beginPath(); ctx.arc(cx, hy, 15, 0, Math.PI * 2); fs(ctx, ch.body);
    if (ch.species === 'penguin') {
      ctx.beginPath(); ctx.ellipse(cx, hy + 4, 10, 8.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = ch.belly; ctx.fill();
    }
    for (const ex of [-6, 6]) {
      ctx.beginPath(); ctx.ellipse(cx + ex, hy + 1, 3.2, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + ex + 0.5, hy + 1.6, 2.1, 2.8, 0, 0, Math.PI * 2); ctx.fillStyle = '#27201a'; ctx.fill();
      ctx.beginPath(); ctx.arc(cx + ex - 0.6, hy + 0.2, 0.9, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,110,135,0.5)';
    ctx.beginPath(); ctx.ellipse(cx - 10.5, hy + 6, 2.8, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 10.5, hy + 6, 2.8, 2, 0, 0, Math.PI * 2); ctx.fill();
    out[ch.id] = c;
  }
  return out;
}

// ---------- 물풍선 (얼굴 달린) ----------

export function renderBalloonFrames() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const [c, ctx] = makeCanvas(TILE, TILE);
    const cx = TILE / 2, cy = TILE / 2 + 3;
    const squish = f === 0 ? 0 : f === 1 ? 1.6 : -1.6;
    const rx = 17.5 + squish, ry = 17.5 - squish;
    // 그림자
    ctx.fillStyle = 'rgba(30,60,20,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, TILE - 4, 13, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 본체
    const grad = ctx.createRadialGradient(cx - 5, cy - 7, 3, cx, cy, rx + 3);
    grad.addColorStop(0, '#bfeaff');
    grad.addColorStop(0.5, '#56b9f5');
    grad.addColorStop(1, '#1f78cf');
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = OUT_W;
    ctx.strokeStyle = '#155a9e';
    ctx.stroke();
    // 매듭
    ctx.beginPath();
    ctx.moveTo(cx - 4.5, cy - ry + 1);
    ctx.quadraticCurveTo(cx, cy - ry - 7, cx + 4.5, cy - ry + 1);
    ctx.closePath();
    fs(ctx, '#1f78cf', 2, '#155a9e');
    // 자는 듯한 눈 (단순한 호 2개) + 입
    ctx.strokeStyle = '#0e3f70';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 1, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.arc(cx + 6, cy - 1, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 2.2, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx - 7, cy - 9, 4.5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    frames.push(c);
  }
  return frames;
}

// ---------- 물줄기 ----------

export function renderWaterSprites() {
  const TH = 32;
  const off = (TILE - TH) / 2;
  const EDGE = '#1565c0';

  const grad = (ctx, vertical) => {
    const g = vertical
      ? ctx.createLinearGradient(off, 0, off + TH, 0)
      : ctx.createLinearGradient(0, off, 0, off + TH);
    g.addColorStop(0, '#9fe2ff');
    g.addColorStop(0.5, '#41acf2');
    g.addColorStop(1, '#9fe2ff');
    return g;
  };

  const sprites = {};

  {
    const [c, ctx] = makeCanvas(TILE, TILE);
    // 중심: 부풀어 오른 물 덩어리
    ctx.beginPath();
    ctx.arc(TILE / 2, TILE / 2, TH / 2 + 4, 0, Math.PI * 2);
    fs(ctx, '#41acf2', OUT_W, EDGE);
    ctx.beginPath();
    ctx.arc(TILE / 2, TILE / 2, TH / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = '#aee6ff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(TILE / 2, TILE / 2, TH / 2 - 11, 0, Math.PI * 2);
    ctx.fillStyle = '#e8f8ff';
    ctx.fill();
    sprites.center = c;
  }

  {
    const [c, ctx] = makeCanvas(TILE, TILE);
    ctx.fillStyle = grad(ctx, false);
    ctx.fillRect(0, off, TILE, TH);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    rr(ctx, 0, off + 7, TILE, 8, 0); ctx.fill();
    ctx.strokeStyle = EDGE; ctx.lineWidth = OUT_W;
    ctx.beginPath(); ctx.moveTo(0, off); ctx.lineTo(TILE, off);
    ctx.moveTo(0, off + TH); ctx.lineTo(TILE, off + TH); ctx.stroke();
    sprites.h = c;
  }
  {
    const [c, ctx] = makeCanvas(TILE, TILE);
    ctx.fillStyle = grad(ctx, true);
    ctx.fillRect(off, 0, TH, TILE);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    rr(ctx, off + 7, 0, 8, TILE, 0); ctx.fill();
    ctx.strokeStyle = EDGE; ctx.lineWidth = OUT_W;
    ctx.beginPath(); ctx.moveTo(off, 0); ctx.lineTo(off, TILE);
    ctx.moveTo(off + TH, 0); ctx.lineTo(off + TH, TILE); ctx.stroke();
    sprites.v = c;
  }

  const endCap = (rot) => {
    const [c, ctx] = makeCanvas(TILE, TILE);
    ctx.translate(TILE / 2, TILE / 2);
    ctx.rotate(rot);
    ctx.translate(-TILE / 2, -TILE / 2);
    // 오른쪽 방향 기준 둥근 끝
    ctx.beginPath();
    ctx.moveTo(0, off);
    ctx.lineTo(TILE - 20, off);
    ctx.quadraticCurveTo(TILE - 2, TILE / 2, TILE - 20, off + TH);
    ctx.lineTo(0, off + TH);
    ctx.fillStyle = grad(ctx, false);
    ctx.fill();
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = OUT_W;
    ctx.beginPath();
    ctx.moveTo(0, off);
    ctx.lineTo(TILE - 20, off);
    ctx.quadraticCurveTo(TILE - 2, TILE / 2, TILE - 20, off + TH);
    ctx.lineTo(0, off + TH);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    rr(ctx, 0, off + 7, TILE - 22, 8, 4); ctx.fill();
    // 튀는 물방울
    for (const [x, y, r] of [[TILE - 8, off + 1, 3], [TILE - 4, TILE / 2 + 8, 2.5], [TILE - 11, off + TH + 2, 2]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      fs(ctx, '#9fe2ff', 1.5, EDGE);
    }
    return c;
  };
  sprites.right = endCap(0);
  sprites.down = endCap(Math.PI / 2);
  sprites.left = endCap(Math.PI);
  sprites.up = endCap(-Math.PI / 2);
  return sprites;
}

// ---------- 갇힘 물방울 ----------

export function renderBubble() {
  const SZ = 68;
  const [c, ctx] = makeCanvas(SZ, SZ);
  const cx = SZ / 2, cy = SZ / 2;
  const r = 29;
  const g = ctx.createRadialGradient(cx - 7, cy - 9, 4, cx, cy, r);
  g.addColorStop(0, 'rgba(225,248,255,0.5)');
  g.addColorStop(0.65, 'rgba(130,205,250,0.35)');
  g.addColorStop(1, 'rgba(55,145,225,0.6)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(21,90,158,0.7)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.stroke();
  // 광택
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 7, -2.4, -1.4);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 7, -1.1, -0.7);
  ctx.stroke();
  return c;
}

// ---------- 아이템 ----------

export function renderItemSprites() {
  const badge = (ring, draw) => {
    const [c, ctx] = makeCanvas(TILE, TILE);
    const cx = TILE / 2, cy = TILE / 2;
    ctx.fillStyle = 'rgba(30,60,20,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, TILE - 5, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 흰 원형 배지 + 컬러 링
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    fs(ctx, '#fff', 3.4, ring);
    // 윗광택
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 9, 7, 3.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    draw(ctx, cx, cy);
    return c;
  };

  return {
    BALLOON: badge('#3d9ce0', (ctx, cx, cy) => {
      const g = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, 11);
      g.addColorStop(0, '#bfeaff');
      g.addColorStop(1, '#1f78cf');
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1.5, 8.5, 9.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#155a9e'; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 8.5);
      ctx.quadraticCurveTo(cx, cy - 14, cx + 3, cy - 8.5);
      ctx.closePath();
      ctx.fillStyle = '#155a9e'; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(cx - 3.5, cy - 2.5, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill();
    }),
    POTION: badge('#2d8fe0', (ctx, cx, cy) => {
      rr(ctx, cx - 7.5, cy - 3, 15, 14, 6);
      fs(ctx, '#2d8fe0', 2, '#16538a');
      ctx.fillStyle = '#8fd0f7';
      rr(ctx, cx - 4.5, cy, 5, 8, 2.5); ctx.fill();
      rr(ctx, cx - 3.5, cy - 12, 7, 9, 2.5);
      fs(ctx, '#c98e4f', 2, '#6d4724');
      ctx.fillStyle = '#8a5f38';
      ctx.fillRect(cx - 3.5, cy - 12, 7, 3);
    }),
    ROLLER: badge('#e8543d', (ctx, cx, cy) => {
      rr(ctx, cx - 10, cy - 9, 14, 12, 5);
      fs(ctx, '#ee5a42', 2, '#9e2a18');
      rr(ctx, cx - 10, cy - 2, 20, 7, 3.5);
      fs(ctx, '#ee5a42', 2, '#9e2a18');
      ctx.fillStyle = '#fff';
      rr(ctx, cx - 7, cy - 6, 8, 2.5, 1); ctx.fill();
      for (const wx of [-5, 5]) {
        ctx.beginPath(); ctx.arc(cx + wx, cy + 9, 3.6, 0, Math.PI * 2);
        fs(ctx, '#ffd84d', 1.8, '#b8860b');
      }
    }),
    NEEDLE: badge('#8d9cb0', (ctx, cx, cy) => {
      ctx.strokeStyle = '#7f93b5';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 9);
      ctx.lineTo(cx + 6, cy - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 11, cy - 10);
      ctx.lineTo(cx + 3, cy - 7);
      ctx.lineTo(cx + 8, cy - 2);
      ctx.closePath();
      fs(ctx, '#5d6f86', 1.6, '#3c4a5c');
      ctx.strokeStyle = '#5d6f86';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx - 9.5, cy + 10.5, 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }),
    ULTRA: badge('#e8a13d', (ctx, cx, cy) => {
      rr(ctx, cx - 7.5, cy - 3, 15, 14, 6);
      fs(ctx, '#ee5a42', 2, '#9e2a18');
      ctx.fillStyle = '#f7a08a';
      rr(ctx, cx - 4.5, cy, 5, 8, 2.5); ctx.fill();
      rr(ctx, cx - 3.5, cy - 12, 7, 9, 2.5);
      fs(ctx, '#c98e4f', 2, '#6d4724');
      // 별
      ctx.fillStyle = '#ffe14d';
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1.4;
      star(ctx, cx, cy + 4, 5, 2.4, 5);
      ctx.fill();
      ctx.stroke();
    }),
    DEVIL: badge('#d63031', (ctx, cx, cy) => {
      ctx.beginPath();
      ctx.arc(cx, cy + 1.5, 10, 0, Math.PI * 2);
      fs(ctx, '#ee4433', 2, '#8e1a10');
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + 9 * s, cy - 3);
        ctx.lineTo(cx + 13 * s, cy - 13);
        ctx.lineTo(cx + 4 * s, cy - 9);
        ctx.closePath();
        fs(ctx, '#ee4433', 1.8, '#8e1a10');
      }
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(cx + 4 * s, cy, 2.4, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 4 * s, cy + 0.8, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#27201a'; ctx.fill();
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy + 5, 4, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }),
  };
}

function star(ctx, cx, cy, rOut, rIn, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---------- 터치 컨트롤 ----------

export function renderTouchControls() {
  // 조이스틱 베이스
  const [base, bctx] = makeCanvas(160, 160);
  bctx.beginPath();
  bctx.arc(80, 80, 70, 0, Math.PI * 2);
  bctx.fillStyle = 'rgba(255,255,255,0.10)';
  bctx.fill();
  bctx.lineWidth = 3;
  bctx.strokeStyle = 'rgba(255,255,255,0.4)';
  bctx.stroke();
  // 방향 화살표
  bctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 4; i++) {
    bctx.save();
    bctx.translate(80, 80);
    bctx.rotate((i * Math.PI) / 2);
    bctx.beginPath();
    bctx.moveTo(0, -56);
    bctx.lineTo(-8, -44);
    bctx.lineTo(8, -44);
    bctx.closePath();
    bctx.fill();
    bctx.restore();
  }

  // 조이스틱 노브
  const [knob, kctx] = makeCanvas(76, 76);
  const kg = kctx.createRadialGradient(33, 31, 5, 38, 38, 36);
  kg.addColorStop(0, 'rgba(255,255,255,0.75)');
  kg.addColorStop(1, 'rgba(190,225,255,0.55)');
  kctx.beginPath();
  kctx.arc(38, 38, 33, 0, Math.PI * 2);
  kctx.fillStyle = kg;
  kctx.fill();
  kctx.lineWidth = 3;
  kctx.strokeStyle = 'rgba(255,255,255,0.8)';
  kctx.stroke();

  // 물풍선 액션 버튼
  const [btn, btnCtx] = makeCanvas(150, 150);
  const bg = btnCtx.createRadialGradient(65, 60, 10, 75, 75, 70);
  bg.addColorStop(0, 'rgba(120,200,255,0.85)');
  bg.addColorStop(1, 'rgba(31,120,207,0.8)');
  btnCtx.beginPath();
  btnCtx.arc(75, 75, 64, 0, Math.PI * 2);
  btnCtx.fillStyle = bg;
  btnCtx.fill();
  btnCtx.lineWidth = 4;
  btnCtx.strokeStyle = 'rgba(255,255,255,0.85)';
  btnCtx.stroke();
  // 풍선 아이콘
  const cx = 75, cy = 72;
  const ig = btnCtx.createRadialGradient(cx - 5, cy - 6, 3, cx, cy, 24);
  ig.addColorStop(0, '#dff4ff');
  ig.addColorStop(1, '#1f78cf');
  btnCtx.beginPath();
  btnCtx.ellipse(cx, cy + 3, 20, 22, 0, 0, Math.PI * 2);
  btnCtx.fillStyle = ig;
  btnCtx.fill();
  btnCtx.lineWidth = 3;
  btnCtx.strokeStyle = '#0e3f70';
  btnCtx.stroke();
  btnCtx.beginPath();
  btnCtx.moveTo(cx - 7, cy - 18);
  btnCtx.quadraticCurveTo(cx, cy - 28, cx + 7, cy - 18);
  btnCtx.closePath();
  btnCtx.fillStyle = '#0e3f70';
  btnCtx.fill();
  btnCtx.fillStyle = 'rgba(255,255,255,0.85)';
  btnCtx.beginPath();
  btnCtx.ellipse(cx - 8, cy - 7, 6, 4, -0.5, 0, Math.PI * 2);
  btnCtx.fill();

  return { base, knob, btn };
}

// ---------- 전체 로드 ----------

export function loadSprites() {
  return {
    ground: [renderGroundTile(false), renderGroundTile(true)],
    solid: renderSolidTile(),
    box: renderBoxTile(),
    chars: renderCharacterSprites(),
    portraits: renderPortraits(),
    balloon: renderBalloonFrames(),
    water: renderWaterSprites(),
    bubble: renderBubble(),
    items: renderItemSprites(),
    touch: renderTouchControls(),
  };
}
