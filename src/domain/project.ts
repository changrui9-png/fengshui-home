import { emptyElevator, suggestElevatorOutside } from "./elevator";
import { uid } from "./ids";
import { parseNarration } from "./transcript";
import type { EvidenceItem, PendingClaim, Project, RoomUsage } from "./types";
import { SCHEMA_VERSION } from "./types";

export function createProject(title = "未命名住宅"): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid("home"),
    title,
    example: false,
    scaleMode: "schematic",
    scaleNote: "格子只表示相对大小，不是测量值。",
    frame: "unlinked",
    plusYBearingDeg: null,
    compassConfirmed: false,
    ownerConfirmation: { topology: false, orientation: false, furniture: false },
    rooms: [],
    openings: [],
    furnishings: [],
    claims: [],
    pendingClaims: [],
    links: [],
    pendingRelations: [],
    elevator: emptyElevator(),
    notes: "",
    evidence: [],
    advanced: {
      sitting: null,
      sittingConfirmed: false,
      buildingYear: null,
      yearConfirmed: false,
      doorVsInterior: "unknown",
    },
    provenance: [],
    ai: {
      analyzed: false,
      provider: null,
      destinationHost: null,
      note: "尚未把画面发送给任何模型。",
    },
    underlayNote: "",
  };
}

export function addEvidence(project: Project, item: Omit<EvidenceItem, "id">): EvidenceItem {
  const evidence = { ...item, id: uid("ev") };
  project.evidence.push(evidence);
  return evidence;
}

const USAGE_BY_NAME: { name: string; usage: RoomUsage }[] = [
  { name: "卫生间", usage: "bath" },
  { name: "厕所", usage: "bath" },
  { name: "厨房", usage: "kitchen" },
  { name: "客厅", usage: "living" },
  { name: "餐厅", usage: "dining" },
  { name: "书房", usage: "study" },
  { name: "阳台", usage: "balcony" },
  { name: "玄关", usage: "entry" },
  { name: "入户", usage: "entry" },
  { name: "主卧", usage: "bedroom" },
  { name: "次卧", usage: "bedroom" },
  { name: "卧室", usage: "bedroom" },
];

export function usageForName(name: string): RoomUsage {
  return USAGE_BY_NAME.find((item) => name.includes(item.name))?.usage ?? "other";
}

/**
 * 把旁白收成待确认条目。不创建房间矩形，不填写尺寸。
 */
export function applyNarration(project: Project, text: string): Project {
  const parsed = parseNarration(text);
  const next: Project = {
    ...project,
    notes: text,
    evidence: [...project.evidence],
    pendingClaims: [...project.pendingClaims],
    pendingRelations: [...project.pendingRelations],
    elevator: { ...project.elevator },
    ai: {
      analyzed: false,
      provider: null,
      destinationHost: null,
      note: "这段文字只在浏览器里按句式摘录，没有视觉模型参与，也没有分析视频画面。",
    },
  };
  const evidence = addEvidence(next, {
    kind: "narration",
    example: project.example,
    text: text.slice(0, 2000),
  });
  for (const claim of parsed.claims) {
    const pending: PendingClaim = {
      id: uid("pend"),
      roomName: claim.roomName,
      azimuthDeg: claim.azimuthDeg,
      reference: claim.quote,
      evidenceId: evidence.id,
    };
    next.pendingClaims.push(pending);
  }
  for (const relation of parsed.relations) {
    next.pendingRelations.push({
      id: uid("rel"),
      fromName: relation.fromName,
      toName: relation.toName,
      note: relation.quote,
      evidenceId: evidence.id,
    });
  }
  if (parsed.elevatorNear) {
    next.elevator.near = parsed.elevatorNear.value;
    next.evidence.push({
      id: uid("ev"),
      kind: "narration",
      example: project.example,
      text: `电梯相关原句：${parsed.elevatorNear.quote}`,
    });
  }
  for (const warning of parsed.warnings) {
    next.evidence.push({
      id: uid("ev"),
      kind: "narration",
      example: project.example,
      text: `未采用：${warning}`,
    });
  }
  return next;
}

export function placeElevatorOutside(project: Project): Project {
  const suggested = suggestElevatorOutside(project.rooms);
  return { ...project, elevator: { ...project.elevator, ...suggested } };
}
