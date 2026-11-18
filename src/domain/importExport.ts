import { cleanText, finiteNumber, optionalNumber } from "./sanitize";
import { SCHEMA_VERSION, type FurnishingKind, type Project, type RoomUsage, type Trigram, type WallSide } from "./types";

const USAGES = new Set<RoomUsage>(["entry", "living", "bedroom", "kitchen", "bath", "dining", "study", "balcony", "other"]);
const KINDS = new Set<FurnishingKind>(["bed", "sofa", "desk", "dining-table", "stove", "sink", "mirror", "toilet", "wardrobe", "tv"]);
const WALLS = new Set<WallSide>(["north", "east", "south", "west"]);
const TRIGRAMS = new Set<Trigram>(["坎", "艮", "震", "巽", "离", "坤", "兑", "乾"]);

export function exportProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function parseProjectJson(raw: string): { ok: true; project: Project } | { ok: false; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ["文件不是有效的 JSON。"] };
  }
  return parseProject(data);
}

export function parseProject(data: unknown): { ok: true; project: Project } | { ok: false; errors: string[] } {
  if (!isRecord(data)) return { ok: false, errors: ["项目文件必须是对象。"] };
  if (data.schemaVersion !== SCHEMA_VERSION) return { ok: false, errors: ["不认识的 schemaVersion，本版只接受 1。"] };
  if (!Array.isArray(data.rooms) || data.rooms.length > 40) return { ok: false, errors: ["房间列表缺失，或超过 40 间。"] };
  if (!Array.isArray(data.openings) || data.openings.length > 80) return { ok: false, errors: ["门窗数量不能超过 80。"] };
  if (!Array.isArray(data.furnishings) || data.furnishings.length > 80) return { ok: false, errors: ["家具数量不能超过 80。"] };

  const rooms = [];
  for (const room of data.rooms) {
    if (!isRecord(room) || typeof room.id !== "string" || !WALLS) return { ok: false, errors: ["房间缺少 id。"] };
    const usage = USAGES.has(room.usage as RoomUsage) ? (room.usage as RoomUsage) : "other";
    rooms.push({
      id: cleanText(room.id, 40),
      name: cleanText(room.name, 40) || "未命名",
      usage,
      x: finiteNumber(room.x, 0, -200, 200),
      y: finiteNumber(room.y, 0, -200, 200),
      widthM: finiteNumber(room.widthM, 3, 0.4, 40),
      heightM: finiteNumber(room.heightM, 3, 0.4, 40),
      rotationDeg: finiteNumber(room.rotationDeg, 0, -180, 180),
    });
  }

  const roomIds = new Set(rooms.map((room) => room.id));
  const openings: Project["openings"] = [];
  for (const opening of data.openings as unknown[]) {
    if (!isRecord(opening) || typeof opening.roomId !== "string" || !roomIds.has(opening.roomId)) {
      return { ok: false, errors: ["有门窗指向不存在的房间。"] };
    }
    if (!WALLS.has(opening.wall as WallSide) || (opening.kind !== "door" && opening.kind !== "window")) {
      return { ok: false, errors: ["门窗的墙或类型无法识别。"] };
    }
    const kind: "door" | "window" = opening.kind === "window" ? "window" : "door";
    openings.push({
      id: cleanText(opening.id, 40) || "opening",
      kind,
      roomId: opening.roomId,
      wall: opening.wall as WallSide,
      offset: finiteNumber(opening.offset, 0.5, 0.05, 0.95),
      widthM: finiteNumber(opening.widthM, 0.9, 0.2, 6),
      isMainEntry: opening.isMainEntry === true,
    });
  }

  const furnishings = [];
  for (const item of data.furnishings as unknown[]) {
    if (!isRecord(item) || typeof item.roomId !== "string" || !roomIds.has(item.roomId)) {
      return { ok: false, errors: ["有家具指向不存在的房间。"] };
    }
    if (!KINDS.has(item.kind as FurnishingKind)) return { ok: false, errors: ["有无法识别的家具类型。"] };
    furnishings.push({
      id: cleanText(item.id, 40) || "item",
      kind: item.kind as FurnishingKind,
      roomId: item.roomId,
      x: finiteNumber(item.x, 0, -200, 200),
      y: finiteNumber(item.y, 0, -200, 200),
      widthM: finiteNumber(item.widthM, 1, 0.2, 8),
      depthM: finiteNumber(item.depthM, 1, 0.2, 8),
      rotationDeg: finiteNumber(item.rotationDeg, 0, -360, 360),
    });
  }

  const elevatorRaw = isRecord(data.elevator) ? data.elevator : {};
  const near = elevatorRaw.near === "yes" || elevatorRaw.near === "no" || elevatorRaw.near === "unknown" ? elevatorRaw.near : "unknown";
  const machineValues = new Set(["", "above", "beside", "other", "none", "unknown"]);
  const machineRoom = machineValues.has(String(elevatorRaw.machineRoom)) ? (elevatorRaw.machineRoom as Project["elevator"]["machineRoom"]) : "";

  const project: Project = {
    schemaVersion: SCHEMA_VERSION,
    id: cleanText(data.id, 40) || "home",
    title: cleanText(data.title, 80) || "未命名住宅",
    example: data.example === true,
    scaleMode: data.scaleMode === "measured" ? "measured" : "schematic",
    scaleNote: cleanText(data.scaleNote, 300) || "未注明比例。",
    frame: data.frame === "shared-plan" ? "shared-plan" : "unlinked",
    plusYBearingDeg: optionalNumber(data.plusYBearingDeg, 0, 360),
    compassConfirmed: data.compassConfirmed === true,
    ownerConfirmation: {
      topology: isRecord(data.ownerConfirmation) && data.ownerConfirmation.topology === true,
      orientation: isRecord(data.ownerConfirmation) && data.ownerConfirmation.orientation === true,
      furniture: isRecord(data.ownerConfirmation) && data.ownerConfirmation.furniture === true,
    },
    rooms,
    openings,
    furnishings,
    claims: sanitizeClaims(data.claims, roomIds),
    pendingClaims: [],
    links: [],
    pendingRelations: [],
    elevator: {
      near,
      relativeToEntry: cleanText(elevatorRaw.relativeToEntry, 300),
      adjacentRoomIds: Array.isArray(elevatorRaw.adjacentRoomIds)
        ? elevatorRaw.adjacentRoomIds.filter((id): id is string => typeof id === "string" && roomIds.has(id)).slice(0, 20)
        : [],
      sharedWallNote: cleanText(elevatorRaw.sharedWallNote, 300),
      doorFacingDeg: optionalNumber(elevatorRaw.doorFacingDeg, 0, 360),
      distanceM: optionalNumber(elevatorRaw.distanceM, 0, 200),
      machineRoom,
      noiseNote: cleanText(elevatorRaw.noiseNote, 300),
      vibrationNote: cleanText(elevatorRaw.vibrationNote, 300),
      x: finiteNumber(elevatorRaw.x, 0, -200, 200),
      y: finiteNumber(elevatorRaw.y, 0, -200, 200),
      widthM: finiteNumber(elevatorRaw.widthM, 1.7, 0.6, 8),
      depthM: finiteNumber(elevatorRaw.depthM, 1.8, 0.6, 8),
      rotationDeg: finiteNumber(elevatorRaw.rotationDeg, 0, -180, 180),
      corridor: sanitizeCorridor(elevatorRaw.corridor),
    },
    notes: cleanText(data.notes, 4000),
    evidence: sanitizeEvidence(data.evidence),
    advanced: sanitizeAdvanced(data.advanced),
    provenance: sanitizeProvenance(data.provenance),
    ai: {
      analyzed: false,
      provider: null,
      destinationHost: null,
      note: "导入的文件不会被当作已经完成的视频分析。",
    },
    underlayNote: cleanText(data.underlayNote, 200),
  };

  if (Array.isArray(data.pendingClaims)) {
    for (const claim of data.pendingClaims.slice(0, 30)) {
      if (!isRecord(claim)) continue;
      project.pendingClaims.push({
        id: cleanText(claim.id, 40) || "pending",
        roomName: cleanText(claim.roomName, 40),
        azimuthDeg: finiteNumber(claim.azimuthDeg, 0, 0, 360),
        reference: cleanText(claim.reference, 400),
        evidenceId: cleanText(claim.evidenceId, 40),
      });
    }
  }

  return { ok: true, project };
}

function sanitizeClaims(value: unknown, roomIds: Set<string>): Project["claims"] {
  if (!Array.isArray(value)) return [];
  const claims: Project["claims"] = [];
  for (const claim of value.slice(0, 40)) {
    if (!isRecord(claim) || typeof claim.roomId !== "string" || !roomIds.has(claim.roomId)) continue;
    if (!WALLS.has(claim.wall as WallSide)) continue;
    claims.push({
      id: cleanText(claim.id, 40) || "claim",
      roomId: claim.roomId,
      wall: claim.wall as WallSide,
      azimuthDeg: finiteNumber(claim.azimuthDeg, 0, 0, 360),
      reference: cleanText(claim.reference, 400),
      status: claim.status === "confirmed" ? "confirmed" : "stated",
      evidenceId: cleanText(claim.evidenceId, 40),
    });
  }
  return claims;
}

function sanitizeCorridor(value: unknown): Project["elevator"]["corridor"] {
  if (!isRecord(value)) return null;
  return {
    x: finiteNumber(value.x, 0, -200, 200),
    y: finiteNumber(value.y, 0, -200, 200),
    widthM: finiteNumber(value.widthM, 1.2, 0.4, 8),
    depthM: finiteNumber(value.depthM, 2, 0.4, 20),
  };
}

function sanitizeEvidence(value: unknown): Project["evidence"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item) => {
    if (!isRecord(item)) return [];
    const kind = ["narration", "plan", "owner", "import", "photo", "ai-hypothesis"].includes(String(item.kind))
      ? (item.kind as Project["evidence"][number]["kind"])
      : "owner";
    return [{ id: cleanText(item.id, 40) || "ev", kind, text: cleanText(item.text, 2000), example: item.example === true }];
  });
}

function sanitizeAdvanced(value: unknown): Project["advanced"] {
  const raw = isRecord(value) ? value : {};
  const sitting = TRIGRAMS.has(raw.sitting as Trigram) ? (raw.sitting as Trigram) : null;
  const door = raw.doorVsInterior === "door-larger" || raw.doorVsInterior === "door-smaller-or-similar" ? raw.doorVsInterior : "unknown";
  return {
    sitting,
    sittingConfirmed: raw.sittingConfirmed === true && sitting != null,
    buildingYear: optionalNumber(raw.buildingYear, 1600, 2300),
    yearConfirmed: raw.yearConfirmed === true && optionalNumber(raw.buildingYear, 1600, 2300) != null,
    doorVsInterior: door,
  };
}

function sanitizeProvenance(value: unknown): Project["provenance"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{ source: cleanText(item.source, 120), url: cleanText(item.url, 300), detail: cleanText(item.detail, 400) }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
