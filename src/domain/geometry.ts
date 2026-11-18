import type { Furnishing, Opening, Room, WallSide } from "./types";

export function normalizeDeg(deg: number): number {
  if (!Number.isFinite(deg)) return NaN;
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** 两个方位角的最小夹角，0 到 180。 */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(d, 360 - d);
}

export function circularMean(degs: number[]): number {
  if (degs.length === 0) return NaN;
  let x = 0;
  let y = 0;
  for (const deg of degs) {
    const r = (normalizeDeg(deg) * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  let out = (Math.atan2(y, x) * 180) / Math.PI;
  if (out < 0) out += 360;
  return out;
}

/** 平面 +y 的罗盘方位已知时，某面墙向外的方位角。 */
export function wallOutwardBearing(plusYBearingDeg: number, wall: WallSide): number {
  const offset = { north: 0, east: 90, south: 180, west: 270 }[wall];
  return normalizeDeg(plusYBearingDeg + offset);
}

/** 由「某一面墙向外朝向某方位」反推平面 +y 的罗盘方位。 */
export function impliedPlusY(wall: WallSide, outwardAzimuth: number): number {
  const offset = { north: 0, east: 90, south: 180, west: 270 }[wall];
  return normalizeDeg(outwardAzimuth - offset);
}

/** 顺时针旋转。坐标系 y 向北、x 向东。 */
export function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  clockwiseDeg: number,
): { x: number; y: number } {
  const r = (clockwiseDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos + dy * sin,
    y: cy - dx * sin + dy * cos,
  };
}

export function bearingOfVector(dx: number, dy: number): number {
  return normalizeDeg((Math.atan2(dx, dy) * 180) / Math.PI);
}

export function roomCenter(room: Room): { x: number; y: number } {
  return { x: room.x + room.widthM / 2, y: room.y + room.heightM / 2 };
}

export function areaWeightedCenter(rooms: Room[]): { x: number; y: number } | null {
  let area = 0;
  let x = 0;
  let y = 0;
  for (const room of rooms) {
    const a = room.widthM * room.heightM;
    if (a <= 0) continue;
    const c = roomCenter(room);
    area += a;
    x += c.x * a;
    y += c.y * a;
  }
  if (area <= 0) return null;
  return { x: x / area, y: y / area };
}

export function footprintBounds(rooms: Room[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (rooms.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const room of rooms) {
    minX = Math.min(minX, room.x);
    minY = Math.min(minY, room.y);
    maxX = Math.max(maxX, room.x + room.widthM);
    maxY = Math.max(maxY, room.y + room.heightM);
  }
  return { minX, minY, maxX, maxY };
}

export function rectsOverlap(
  a: { x: number; y: number; widthM: number; depthM: number },
  b: { x: number; y: number; widthM: number; depthM: number },
  gap = 0,
): boolean {
  return (
    a.x < b.x + b.widthM + gap &&
    a.x + a.widthM + gap > b.x &&
    a.y < b.y + b.depthM + gap &&
    a.y + a.depthM + gap > b.y
  );
}

export function openingCenter(room: Room, opening: Opening): { x: number; y: number } {
  switch (opening.wall) {
    case "north":
      return { x: room.x + opening.offset * room.widthM, y: room.y + room.heightM };
    case "south":
      return { x: room.x + opening.offset * room.widthM, y: room.y };
    case "east":
      return { x: room.x + room.widthM, y: room.y + opening.offset * room.heightM };
    case "west":
      return { x: room.x, y: room.y + opening.offset * room.heightM };
  }
}

/** 家具局部坐标：+y 为正面。rotationDeg 为顺时针，y 向北。 */
export function furnishingPoint(item: Furnishing, localX: number, localY: number): { x: number; y: number } {
  const r = (item.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    x: item.x + localX * cos + localY * sin,
    y: item.y - localX * sin + localY * cos,
  };
}

export function frontBearing(item: Furnishing): number {
  const front = furnishingPoint(item, 0, 1);
  return bearingOfVector(front.x - item.x, front.y - item.y);
}

export function distancePointToRoomWalls(room: Room, x: number, y: number): number {
  const candidates = [
    x >= room.x && x <= room.x + room.widthM ? Math.abs(y - room.y) : Infinity,
    x >= room.x && x <= room.x + room.widthM ? Math.abs(y - (room.y + room.heightM)) : Infinity,
    y >= room.y && y <= room.y + room.heightM ? Math.abs(x - room.x) : Infinity,
    y >= room.y && y <= room.y + room.heightM ? Math.abs(x - (room.x + room.widthM)) : Infinity,
  ];
  return Math.min(...candidates);
}
