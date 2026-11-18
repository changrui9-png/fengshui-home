import { createProject, usageForName } from "./project";
import { uid } from "./ids";
import type { Project } from "./types";

export interface VideoTo3dImport {
  ok: true;
  project: Project;
  warnings: string[];
}

export interface VideoTo3dReject {
  ok: false;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 读取 video-to-3d 的 scene.json。
 * 它给出的是单间矩形和不确定度，没有罗盘，也没有家具。
 * https://github.com/Srijjit-V/video-to-3d （MIT）
 */
export function importVideoTo3dScene(input: unknown): VideoTo3dImport | VideoTo3dReject {
  if (!isRecord(input) || !isRecord(input.room)) {
    return { ok: false, errors: ["这不是 video-to-3d 的 scene.json：缺少 room 对象。"] };
  }
  const room = input.room;
  const warnings: string[] = [];
  const project = createProject("video-to-3d 导入的单间");
  project.frame = "unlinked";
  project.plusYBearingDeg = null;
  project.compassConfirmed = false;
  project.provenance.push({
    source: "video-to-3d scene.json",
    url: "https://github.com/Srijjit-V/video-to-3d",
    detail: "MIT。只读取测量结果，不包含该项目的重建代码。结果没有朝向。",
  });

  const confidence = isRecord(input.confidence) ? input.confidence : {};
  const label = typeof confidence.label === "string" ? confidence.label : "unknown";
  if (Array.isArray(input.warnings)) {
    for (const warning of input.warnings) {
      if (typeof warning === "string") warnings.push(warning);
    }
  }
  project.evidence.push({
    id: uid("ev"),
    kind: "import",
    example: false,
    text: `video-to-3d 信心标签：${label}。${warnings.join(" ")}`.slice(0, 2000),
  });

  if (room.incomplete === true || !Array.isArray(room.rect_m) || room.rect_m.length !== 4) {
    warnings.push(typeof room.reason === "string" ? room.reason : "scene.json 没有完整矩形，因此不创建房间尺寸。");
    project.scaleMode = "schematic";
    project.scaleNote = "导入的测量不完整，没有采用长宽。";
    return { ok: true, project, warnings };
  }

  const [x0, z0, x1, z1] = room.rect_m.map(Number);
  if (![x0, z0, x1, z1].every(Number.isFinite)) {
    return { ok: false, errors: ["rect_m 含有无法读取的数字。"] };
  }
  const width = Math.abs(x1 - x0);
  const depth = Math.abs(z1 - z0);
  if (width < 0.5 || depth < 0.5 || width > 40 || depth > 40) {
    return { ok: false, errors: ["房间边长超出可接受范围（0.5 到 40 米）。"] };
  }
  project.scaleMode = "measured";
  project.scaleNote = typeof input.scale_method === "string" ? `沿用 video-to-3d 的尺度说明：${input.scale_method}` : "尺度来自 scene.json。";
  project.rooms.push({
    id: uid("room"),
    name: "未命名房间",
    usage: usageForName("其他"),
    x: Math.min(x0, x1),
    y: Math.min(z0, z1),
    widthM: width,
    heightM: depth,
    rotationDeg: 0,
  });
  warnings.push("只导入了一间矩形。没有朝向、门窗和家具；请用旁白或罗盘另作确认。一个房间的尺寸不能推出住宅里其他房间。");
  return { ok: true, project, warnings };
}
