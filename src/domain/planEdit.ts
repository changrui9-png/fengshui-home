import { footprintBounds } from "./geometry";
import { uid } from "./ids";
import type { ElevatorState, Opening, Project, Room, RoomUsage, WallSide } from "./types";

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ROOM_PRESETS: { name: string; usage: RoomUsage; widthM: number; heightM: number }[] = [
  { name: "男主人房", usage: "bedroom", widthM: 3.6, heightM: 3.2 },
  { name: "女主人房", usage: "bedroom", widthM: 3.4, heightM: 3.2 },
  { name: "儿童房", usage: "bedroom", widthM: 3, heightM: 2.8 },
  { name: "客房", usage: "bedroom", widthM: 3, heightM: 2.8 },
  { name: "客厅", usage: "living", widthM: 4.6, heightM: 3.4 },
  { name: "餐厅", usage: "dining", widthM: 3.2, heightM: 2.8 },
  { name: "厨房", usage: "kitchen", widthM: 2.8, heightM: 2.4 },
  { name: "卫生间", usage: "bath", widthM: 2.2, heightM: 1.8 },
  { name: "厕所", usage: "bath", widthM: 1.6, heightM: 1.4 },
  { name: "书房", usage: "study", widthM: 2.8, heightM: 2.6 },
  { name: "入户", usage: "entry", widthM: 2, heightM: 1.6 },
];

const MIN_ROOM = 0.6;
const MIN_ITEM = 0.3;
const MIN_OPENING = 0.3;

export function snap(value: number, step = 0.1): number {
  const snapped = Math.round(value / step) * step;
  return Math.round(snapped * 1000) / 1000;
}

export function resizeBox(box: Box, handle: Handle, dx: number, dy: number, min = MIN_ROOM): Box {
  let { x, y, width, height } = box;
  const east = x + width;
  const north = y + height;
  if (handle.includes("e")) width = Math.max(min, width + dx);
  if (handle.includes("w")) {
    const nextX = Math.min(x + dx, east - min);
    width = east - nextX;
    x = nextX;
  }
  if (handle.includes("n")) height = Math.max(min, height + dy);
  if (handle.includes("s")) {
    const nextY = Math.min(y + dy, north - min);
    height = north - nextY;
    y = nextY;
  }
  return { x: snap(x), y: snap(y), width: snap(width), height: snap(height) };
}

/** 家具以中心为锚。拖动一边时，对边保持不动。 */
export function resizeCentered(
  item: { x: number; y: number; width: number; depth: number },
  handle: Handle,
  dx: number,
  dy: number,
  min = MIN_ITEM,
): { x: number; y: number; width: number; depth: number } {
  let { x, y, width, depth } = item;
  const west = x - width / 2;
  const east = x + width / 2;
  const south = y - depth / 2;
  const north = y + depth / 2;
  if (handle.includes("e")) {
    const edge = Math.max(west + min, east + dx);
    width = snap(edge - west);
    x = west + width / 2;
  }
  if (handle.includes("w")) {
    const edge = Math.min(east - min, west + dx);
    width = snap(east - edge);
    x = east - width / 2;
  }
  if (handle.includes("n")) {
    const edge = Math.max(south + min, north + dy);
    depth = snap(edge - south);
    y = south + depth / 2;
  }
  if (handle.includes("s")) {
    const edge = Math.min(north - min, south + dy);
    depth = snap(north - edge);
    y = north - depth / 2;
  }
  return { x, y, width, depth };
}

export function wallLength(room: Room, wall: WallSide): number {
  return wall === "north" || wall === "south" ? room.widthM : room.heightM;
}

export function fitOpening(room: Room, opening: Opening): Opening {
  const length = Math.max(wallLength(room, opening.wall), MIN_OPENING + 0.1);
  const widthM = Math.min(Math.max(MIN_OPENING, opening.widthM), length - 0.1);
  const half = widthM / 2;
  let center = opening.offset * wallLength(room, opening.wall);
  if (!Number.isFinite(center)) center = length / 2;
  center = Math.min(length - half, Math.max(half, center));
  return { ...opening, widthM: snap(widthM), offset: center / length };
}

export function moveOpening(room: Room, opening: Opening, deltaAlong: number): Opening {
  const length = wallLength(room, opening.wall);
  return fitOpening(room, { ...opening, offset: opening.offset + deltaAlong / Math.max(length, 0.1) });
}

/** 正方向的一端跟着移动，另一端不动。 */
export function resizeOpening(room: Room, opening: Opening, deltaAlong: number): Opening {
  const length = wallLength(room, opening.wall);
  const center = opening.offset * length;
  const start = center - opening.widthM / 2;
  return fitOpening(room, {
    ...opening,
    widthM: opening.widthM + deltaAlong,
    offset: length === 0 ? 0.5 : (start + (opening.widthM + deltaAlong) / 2) / length,
  });
}

export interface OpeningSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  handleX: number;
  handleY: number;
}

export function openingSegment(room: Room, opening: Opening): OpeningSegment {
  const fitted = fitOpening(room, opening);
  const length = wallLength(room, fitted.wall);
  const center = fitted.offset * length;
  const half = fitted.widthM / 2;
  if (fitted.wall === "north" || fitted.wall === "south") {
    const y = fitted.wall === "north" ? room.y + room.heightM : room.y;
    const x1 = room.x + center - half;
    const x2 = room.x + center + half;
    return { x1, y1: y, x2, y2: y, handleX: x2, handleY: y };
  }
  const x = fitted.wall === "east" ? room.x + room.widthM : room.x;
  const y1 = room.y + center - half;
  const y2 = room.y + center + half;
  return { x1: x, y1, x2: x, y2, handleX: x, handleY: y2 };
}

export function placePreset(project: Project, name: string): Room {
  const preset = ROOM_PRESETS.find((item) => item.name === name) ?? {
    name,
    usage: "other" as RoomUsage,
    widthM: 3,
    heightM: 3,
  };
  const bounds = footprintBounds(project.rooms);
  return {
    id: uid("room"),
    name: preset.name,
    usage: preset.usage,
    x: bounds ? snap(bounds.maxX + 0.4) : 0,
    y: bounds ? snap(bounds.minY) : 0,
    widthM: preset.widthM,
    heightM: preset.heightM,
    rotationDeg: 0,
  };
}

export function balconyOnWall(host: Room, wall: WallSide): Room {
  const depth = 1.2;
  if (wall === "north") {
    return { id: uid("room"), name: "阳台", usage: "balcony", x: host.x, y: snap(host.y + host.heightM), widthM: host.widthM, heightM: depth, rotationDeg: 0 };
  }
  if (wall === "south") {
    return { id: uid("room"), name: "阳台", usage: "balcony", x: host.x, y: snap(host.y - depth), widthM: host.widthM, heightM: depth, rotationDeg: 0 };
  }
  if (wall === "east") {
    return { id: uid("room"), name: "阳台", usage: "balcony", x: snap(host.x + host.widthM), y: host.y, widthM: depth, heightM: host.heightM, rotationDeg: 0 };
  }
  return { id: uid("room"), name: "阳台", usage: "balcony", x: snap(host.x - depth), y: host.y, widthM: depth, heightM: host.heightM, rotationDeg: 0 };
}

export type EditGesture =
  | { kind: "move-room"; id: string; dx: number; dy: number }
  | { kind: "resize-room"; id: string; handle: Handle; dx: number; dy: number }
  | { kind: "move-furnishing"; id: string; dx: number; dy: number }
  | { kind: "resize-furnishing"; id: string; handle: Handle; dx: number; dy: number }
  | { kind: "move-opening"; id: string; deltaAlong: number }
  | { kind: "resize-opening"; id: string; deltaAlong: number }
  | { kind: "move-elevator"; dx: number; dy: number };

export function applyGesture(project: Project, gesture: EditGesture): Project {
  if (gesture.kind === "move-room" || gesture.kind === "resize-room") {
    return {
      ...project,
      rooms: project.rooms.map((room) => {
        if (room.id !== gesture.id) return room;
        if (gesture.kind === "move-room") {
          return { ...room, x: snap(room.x + gesture.dx), y: snap(room.y + gesture.dy) };
        }
        const box = resizeBox({ x: room.x, y: room.y, width: room.widthM, height: room.heightM }, gesture.handle, gesture.dx, gesture.dy);
        return { ...room, x: box.x, y: box.y, widthM: box.width, heightM: box.height };
      }),
    };
  }
  if (gesture.kind === "move-furnishing" || gesture.kind === "resize-furnishing") {
    return {
      ...project,
      furnishings: project.furnishings.map((item) => {
        if (item.id !== gesture.id) return item;
        if (gesture.kind === "move-furnishing") {
          return { ...item, x: snap(item.x + gesture.dx), y: snap(item.y + gesture.dy) };
        }
        const next = resizeCentered({ x: item.x, y: item.y, width: item.widthM, depth: item.depthM }, gesture.handle, gesture.dx, gesture.dy);
        return { ...item, ...{ x: next.x, y: next.y, widthM: next.width, depthM: next.depth } };
      }),
    };
  }
  if (gesture.kind === "move-opening" || gesture.kind === "resize-opening") {
    return {
      ...project,
      openings: project.openings.map((opening) => {
        if (opening.id !== gesture.id) return opening;
        const room = project.rooms.find((item) => item.id === opening.roomId);
        if (!room) return opening;
        return gesture.kind === "move-opening" ? moveOpening(room, opening, gesture.deltaAlong) : resizeOpening(room, opening, gesture.deltaAlong);
      }),
    };
  }
  return { ...project, elevator: moveElevator(project.elevator, gesture.dx, gesture.dy) };
}

function moveElevator(elevator: ElevatorState, dx: number, dy: number): ElevatorState {
  const x = snap(elevator.x + dx);
  const y = snap(elevator.y + dy);
  const appliedX = x - elevator.x;
  const appliedY = y - elevator.y;
  return {
    ...elevator,
    x,
    y,
    corridor: elevator.corridor
      ? { ...elevator.corridor, x: elevator.corridor.x + appliedX, y: elevator.corridor.y + appliedY }
      : null,
  };
}

export function isHandle(value: string): value is Handle {
  return value === "n" || value === "s" || value === "e" || value === "w" || value === "ne" || value === "nw" || value === "se" || value === "sw";
}
