import { angleDiff, circularMean, impliedPlusY } from "./geometry";
import type { OrientationClaim, OrientationResolution, Project } from "./types";

const AGREE_DEG = 20;

function blankRooms(project: Project, reason: string, plusY: number | null = null, known = false): OrientationResolution["rooms"] {
  const rooms: OrientationResolution["rooms"] = {};
  for (const room of project.rooms) {
    rooms[room.id] = { known, plusYBearingDeg: known ? plusY : null, reason };
  }
  return rooms;
}

/**
 * 朝向只在证据够用时成立。
 * 一个房间的窗户方位不能给其他房间定位，也不能在没有共用平面时改写它们的墙向。
 */
export function resolveOrientations(project: Project): OrientationResolution {
  const confirmed = project.claims.filter((claim) => claim.status === "confirmed" && project.rooms.some((room) => room.id === claim.roomId));
  const contradictions: string[] = [];
  const questions: string[] = [];

  if (project.frame === "unlinked") {
    return resolveUnlinked(project, confirmed, questions);
  }

  const implied = confirmed.map((claim) => impliedPlusY(claim.wall, claim.azimuthDeg));
  let plusY = project.compassConfirmed ? project.plusYBearingDeg : null;

  if (implied.length > 0) {
    const spread = implied.reduce((max, deg) => Math.max(max, angleDiff(deg, implied[0])), 0);
    if (spread > AGREE_DEG) {
      contradictions.push("已确认的朝向彼此不一致，夹角超过 20 度。在业主指出哪一条算数之前，不为整张平面采用其中任何一条。");
      questions.push("请核对相互矛盾的朝向：它们可能来自不同房间的窗户，不能同时当作整宅的北。");
      return {
        plusYBearingDeg: null,
        rooms: blankRooms(project, "朝向证据互相矛盾，整图墙向暂不采用。"),
        contradictions,
        questions,
        anchoredFromClaim: false,
      };
    }
    const fromClaims = circularMean(implied);
    if (plusY != null && angleDiff(plusY, fromClaims) > AGREE_DEG) {
      contradictions.push("业主确认的整图罗盘，和房间墙面朝向对不上。");
      questions.push("整图的北与某一面墙的朝向不一致。请改正罗盘，或改正那面墙的朝向。");
      return {
        plusYBearingDeg: null,
        rooms: blankRooms(project, "整图罗盘与墙面朝向矛盾，墙向暂不采用。"),
        contradictions,
        questions,
        anchoredFromClaim: false,
      };
    }
    if (plusY == null) plusY = fromClaims;
  }

  if (plusY == null) {
    questions.push("这张平面还没有确认的北，也没有一面墙的向外方位。不能给房间写罗盘朝向。");
    return {
      plusYBearingDeg: null,
      rooms: blankRooms(project, "共用平面还没有罗盘锚点。"),
      contradictions,
      questions,
      anchoredFromClaim: false,
    };
  }

  const reason = project.compassConfirmed
    ? "房间在同一张已确认的平面上，墙向随整图罗盘旋转。"
    : "房间在同一张已确认的平面上，由一面墙的向外方位锚定整图，其他房间只因此共享墙向，位置并不由此发明。";

  return {
    plusYBearingDeg: plusY,
    rooms: blankRooms(project, reason, plusY, true),
    contradictions,
    questions,
    anchoredFromClaim: !project.compassConfirmed && confirmed.length > 0,
  };
}

function resolveUnlinked(project: Project, confirmed: OrientationClaim[], questions: string[]): OrientationResolution {
  const rooms: OrientationResolution["rooms"] = {};
  const byRoom = new Map<string, OrientationClaim[]>();
  for (const claim of confirmed) {
    const list = byRoom.get(claim.roomId) ?? [];
    list.push(claim);
    byRoom.set(claim.roomId, list);
  }

  for (const room of project.rooms) {
    const claims = byRoom.get(room.id) ?? [];
    if (claims.length === 0) {
      rooms[room.id] = {
        known: false,
        plusYBearingDeg: null,
        reason: "没有这个房间自己的朝向证据。另一个房间的朝向不能推出它的位置或墙向。",
      };
      continue;
    }
    const implied = claims.map((claim) => impliedPlusY(claim.wall, claim.azimuthDeg));
    const spread = implied.reduce((max, deg) => Math.max(max, angleDiff(deg, implied[0])), 0);
    if (spread > AGREE_DEG) {
      rooms[room.id] = {
        known: false,
        plusYBearingDeg: null,
        reason: "这个房间自己的几条朝向互相矛盾。",
      };
      questions.push(`请核对「${room.name}」里互相矛盾的朝向。`);
      continue;
    }
    rooms[room.id] = {
      known: true,
      plusYBearingDeg: circularMean(implied),
      reason: "只采用这个房间自己的墙面朝向，没有推广到其他房间。",
    };
  }

  if (confirmed.length > 0 && project.rooms.length > 1) {
    questions.push("目前只有个别房间的朝向，房间之间又没有确认的共用平面。不会据此排列其他房间，也不会给它们写朝向。若要一起判断，请确认相对位置，或提供连续走访。");
  }

  return {
    plusYBearingDeg: null,
    rooms,
    contradictions: [],
    questions,
    anchoredFromClaim: false,
  };
}

export function roomPlusY(resolution: OrientationResolution, roomId: string): number | null {
  const row = resolution.rooms[roomId];
  if (!row?.known || row.plusYBearingDeg == null) return null;
  return row.plusYBearingDeg;
}
