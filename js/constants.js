// 게임 전역 상수

export const TILE = 48;            // 타일 크기(px)
export const COLS = 15;            // 맵 가로 칸 수
export const ROWS = 13;            // 맵 세로 칸 수
export const HUD_H = 64;           // 상단 HUD 높이(px)
export const CANVAS_W = COLS * TILE;            // 720
export const CANVAS_H = ROWS * TILE + HUD_H;    // 688

// 타일 종류
export const T_EMPTY = 0;
export const T_SOLID = 1;   // 파괴 불가 블록
export const T_BOX = 2;     // 파괴 가능 상자

// 플레이어 상태
export const ST_ALIVE = 'alive';
export const ST_TRAPPED = 'trapped';
export const ST_DEAD = 'dead';

// 능력치 한계
export const MAX_BALLOONS = 6;
export const MAX_STREAM = 7;
export const MAX_SPEED = 5;

// 타이밍(초)
export const BALLOON_FUSE = 3.0;       // 물풍선 폭발 대기
export const WATER_DURATION = 0.45;    // 물줄기 지속
export const TRAP_DURATION = 7.0;      // 갇힘 → 사망까지
export const ROUND_TIME = 120;         // 라운드 제한 시간
export const ITEM_DROP_RATE = 0.45;    // 상자 파괴 시 아이템 드랍률

// 이동 속도 (px/초): speed 스탯 1~5
export const SPEED_TABLE = [0, 150, 180, 210, 240, 275];
export const TRAPPED_SPEED = 70;

// 아이템 종류와 드랍 가중치
export const ITEMS = {
  BALLOON: { key: 'BALLOON', weight: 30 },  // 물풍선 +1
  POTION:  { key: 'POTION',  weight: 30 },  // 물줄기 +1
  ROLLER:  { key: 'ROLLER',  weight: 20 },  // 속도 +1
  NEEDLE:  { key: 'NEEDLE',  weight: 12 },  // 바늘(갇힘 탈출)
  ULTRA:   { key: 'ULTRA',   weight: 4 },   // 물줄기 최대
  DEVIL:   { key: 'DEVIL',   weight: 4 },   // 속도 최대
};

// 오리지널 캐릭터 (SD 동물 컨셉)
export const CHARACTERS = [
  { id: 'coco', name: '코코', species: 'cat',     body: '#ff9f43', belly: '#ffe8cc', accent: '#e17055' },
  { id: 'bori', name: '보리', species: 'dog',     body: '#b07d4f', belly: '#f5e6cf', accent: '#7d5a3c' },
  { id: 'pino', name: '피노', species: 'penguin', body: '#34495e', belly: '#ecf0f1', accent: '#f39c12' },
  { id: 'lulu', name: '루루', species: 'rabbit',  body: '#fd9bbf', belly: '#ffe3ee', accent: '#e84393' },
];

// 스폰 위치 (네 모서리)
export const SPAWNS = [
  { gx: 0, gy: 0 },
  { gx: COLS - 1, gy: ROWS - 1 },
  { gx: COLS - 1, gy: 0 },
  { gx: 0, gy: ROWS - 1 },
];

export const DIRS = {
  up:    { dx: 0, dy: -1 },
  down:  { dx: 0, dy: 1 },
  left:  { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
