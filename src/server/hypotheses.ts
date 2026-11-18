import { cleanText } from "../domain/sanitize";
import type { FurnishingKind, Project, RoomUsage } from "../domain/types";
import { usageForName } from "../domain/project";
import { uid } from "../domain/ids";

const KINDS = new Set<FurnishingKind>(["bed", "sofa", "desk", "dining-table", "stove", "sink", "mirror", "toilet", "wardrobe", "tv"]);

export interface AcceptedHypothesis {
  rooms: { name: string; usage: RoomUsage; evidenceQuote: string; azimuthDeg: number | null }[];
  relations: { fromName: string; toName: string; evidenceQuote: string }[];
  furnishings: { roomName: string; kind: FurnishingKind; evidenceQuote: string }[];
  elevatorNear: "yes" | "no" | "unknown" | null;
  uncertainties: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function quoteOk(quote: string, corpus: string, hasFrames: boolean): boolean {
  if (!quote) return false;
  if (corpus.includes(quote)) return true;
  return hasFrames && quote.startsWith("画面");
}

/**
 * 模型输出里没有原文或画面依据的房间、尺寸和家具会被丢掉。
 */
export function acceptHypotheses(transcript: string, notes: string, raw: unknown, hasFrames: boolean): { accepted: AcceptedHypothesis; dropped: string[] } {
  const corpus = `${transcript}\n${notes}`;
  const dropped: string[] = [];
  const accepted: AcceptedHypothesis = { rooms: [], relations: [], furnishings: [], elevatorNear: null, uncertainties: [] };
  const root = asRecord(raw);
  if (!root) {
    dropped.push("模型没有返回对象。");
    return { accepted, dropped };
  }

  const rooms = Array.isArray(root.rooms) ? root.rooms.slice(0, 20) : [];
  for (const item of rooms) {
    const row = asRecord(item);
    if (!row) continue;
    const name = cleanText(row.name, 40);
    const quote = cleanText(row.evidenceQuote, 400);
    if (!name || !quoteOk(quote, corpus, hasFrames)) {
      dropped.push(`房间「${name || "未命名"}」没有能够核对的依据。`);
      continue;
    }
    if ("widthM" in row || "x" in row || "dimensions" in row) dropped.push(`已忽略「${name}」附带的尺寸。`);
    const azimuth = typeof row.azimuthDeg === "number" && Number.isFinite(row.azimuthDeg) ? ((row.azimuthDeg % 360) + 360) % 360 : null;
    accepted.rooms.push({ name, usage: usageForName(name), evidenceQuote: quote, azimuthDeg: azimuth });
  }

  const relations = Array.isArray(root.relations) ? root.relations.slice(0, 20) : [];
  for (const item of relations) {
    const row = asRecord(item);
    if (!row) continue;
    const quote = cleanText(row.evidenceQuote, 400);
    const fromName = cleanText(row.fromName ?? row.a, 40);
    const toName = cleanText(row.toName ?? row.b, 40);
    if (!fromName || !toName || !quoteOk(quote, corpus, hasFrames)) {
      dropped.push("一条相邻关系缺少依据。");
      continue;
    }
    accepted.relations.push({ fromName, toName, evidenceQuote: quote });
  }

  const furnishings = Array.isArray(root.furnishings) ? root.furnishings.slice(0, 30) : [];
  for (const item of furnishings) {
    const row = asRecord(item);
    if (!row) continue;
    const kind = String(row.kind);
    const quote = cleanText(row.evidenceQuote, 400);
    const roomName = cleanText(row.roomName ?? row.room, 40);
    if (!KINDS.has(kind as FurnishingKind) || !quoteOk(quote, corpus, hasFrames)) {
      dropped.push(`家具「${cleanText(kind, 40)}」未采用。`);
      continue;
    }
    accepted.furnishings.push({ roomName, kind: kind as FurnishingKind, evidenceQuote: quote });
  }

  const elevator = asRecord(root.elevator);
  if (elevator) {
    const quote = cleanText(elevator.evidenceQuote, 400);
    const near = elevator.near === "yes" || elevator.near === "no" || elevator.near === "unknown" ? elevator.near : null;
    if (near && quoteOk(quote, corpus, hasFrames)) accepted.elevatorNear = near;
    else if (near) dropped.push("电梯判断没有依据，已丢弃。");
  }

  if (Array.isArray(root.uncertainties)) {
    accepted.uncertainties = root.uncertainties.slice(0, 12).map((item) => cleanText(item, 300)).filter(Boolean);
  }
  return { accepted, dropped };
}

export function applyHypotheses(
  project: Project,
  accepted: AcceptedHypothesis,
  meta: { provider: string; destinationHost: string },
): Project {
  const next: Project = {
    ...project,
    pendingClaims: [...project.pendingClaims],
    pendingRelations: [...project.pendingRelations],
    evidence: [...project.evidence],
    elevator: { ...project.elevator },
    ai: {
      analyzed: true,
      provider: meta.provider,
      destinationHost: meta.destinationHost,
      note: "模型只提供了待确认的假设。它没有测量尺寸，也没有被当成最终平面。",
    },
  };
  for (const room of accepted.rooms) {
    next.evidence.push({
      id: uid("ev"),
      kind: "ai-hypothesis",
      example: false,
      text: `假设中的房间「${room.name}」。依据：${room.evidenceQuote}`,
    });
    if (room.azimuthDeg != null) {
      next.pendingClaims.push({
        id: uid("pend"),
        roomName: room.name,
        azimuthDeg: room.azimuthDeg,
        reference: room.evidenceQuote,
        evidenceId: next.evidence[next.evidence.length - 1].id,
      });
    }
  }
  for (const relation of accepted.relations) {
    next.pendingRelations.push({
      id: uid("rel"),
      fromName: relation.fromName,
      toName: relation.toName,
      note: relation.evidenceQuote,
      evidenceId: "ai",
    });
  }
  for (const item of accepted.furnishings) {
    next.evidence.push({
      id: uid("ev"),
      kind: "ai-hypothesis",
      example: false,
      text: `假设「${item.roomName}」里有${item.kind}，请自行在图上添加。依据：${item.evidenceQuote}`,
    });
  }
  if (accepted.elevatorNear) next.elevator.near = accepted.elevatorNear;
  for (const uncertainty of accepted.uncertainties) {
    next.evidence.push({ id: uid("ev"), kind: "ai-hypothesis", example: false, text: `模型标明的不确定：${uncertainty}` });
  }
  return next;
}
