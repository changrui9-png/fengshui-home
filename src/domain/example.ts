import type { Project } from "./types";

/** 示例住宅。所有句子都是虚构的，用来演示流程。 */
export function exampleProject(): Project {
  return {
    schemaVersion: 1,
    id: "example-home",
    title: "示例：北向入户的小套间",
    example: true,
    scaleMode: "schematic",
    scaleNote: "示例格子，不是某套真实住宅的测量。",
    frame: "shared-plan",
    plusYBearingDeg: 0,
    compassConfirmed: true,
    ownerConfirmation: { topology: false, orientation: false, furniture: false },
    rooms: [
      { id: "entry", name: "玄关", usage: "entry", x: 3.2, y: 6.2, widthM: 2.2, heightM: 1.6, rotationDeg: 0 },
      { id: "living", name: "客厅", usage: "living", x: 1.2, y: 3.2, widthM: 4.6, heightM: 3, rotationDeg: 0 },
      { id: "bedroom", name: "主卧", usage: "bedroom", x: 5.8, y: 3.6, widthM: 3.4, heightM: 3.2, rotationDeg: 0 },
      { id: "kitchen", name: "厨房", usage: "kitchen", x: 1.2, y: 0.6, widthM: 2.8, heightM: 2.6, rotationDeg: 0 },
      { id: "bath", name: "卫生间", usage: "bath", x: 4, y: 0.6, widthM: 2.2, heightM: 2.6, rotationDeg: 0 },
    ],
    openings: [
      { id: "door-entry", kind: "door", roomId: "entry", wall: "north", offset: 0.5, widthM: 0.9, isMainEntry: true },
      { id: "door-entry-living", kind: "door", roomId: "entry", wall: "south", offset: 0.5, widthM: 0.8 },
      { id: "door-bed", kind: "door", roomId: "bedroom", wall: "west", offset: 0.45, widthM: 0.8 },
      { id: "door-kitchen", kind: "door", roomId: "kitchen", wall: "north", offset: 0.7, widthM: 0.8 },
      { id: "door-bath", kind: "door", roomId: "bath", wall: "north", offset: 0.35, widthM: 0.7 },
      { id: "win-bed", kind: "window", roomId: "bedroom", wall: "east", offset: 0.55, widthM: 1.4 },
      { id: "win-living", kind: "window", roomId: "living", wall: "south", offset: 0.45, widthM: 1.8 },
      { id: "win-kitchen", kind: "window", roomId: "kitchen", wall: "west", offset: 0.5, widthM: 0.9 },
    ],
    furnishings: [
      { id: "bed", kind: "bed", roomId: "bedroom", x: 7.5, y: 4.7, widthM: 1.8, depthM: 2, rotationDeg: 0 },
      { id: "desk", kind: "desk", roomId: "bedroom", x: 8.4, y: 6.45, widthM: 1.2, depthM: 0.6, rotationDeg: 180 },
      { id: "mirror", kind: "mirror", roomId: "bedroom", x: 7.5, y: 6.5, widthM: 0.5, depthM: 0.08, rotationDeg: 180 },
      { id: "sofa", kind: "sofa", roomId: "living", x: 3, y: 5.4, widthM: 2.2, depthM: 0.9, rotationDeg: 180 },
      { id: "dining", kind: "dining-table", roomId: "living", x: 3.4, y: 3.9, widthM: 1.4, depthM: 0.9, rotationDeg: 0 },
      { id: "stove", kind: "stove", roomId: "kitchen", x: 1.8, y: 2.6, widthM: 0.6, depthM: 0.6, rotationDeg: 0 },
      { id: "sink", kind: "sink", roomId: "kitchen", x: 3.2, y: 2.6, widthM: 0.5, depthM: 0.4, rotationDeg: 0 },
      { id: "toilet", kind: "toilet", roomId: "bath", x: 4.7, y: 1.3, widthM: 0.4, depthM: 0.7, rotationDeg: 0 },
    ],
    claims: [
      {
        id: "claim-entry",
        roomId: "entry",
        wall: "north",
        azimuthDeg: 0,
        reference: "示例旁白：站在玄关，打开入户门向外，罗盘是北。",
        status: "confirmed",
        evidenceId: "ev-example",
      },
      {
        id: "claim-bed",
        roomId: "bedroom",
        wall: "east",
        azimuthDeg: 90,
        reference: "示例旁白：站在主卧，面对东窗向外，方位角 90 度。",
        status: "confirmed",
        evidenceId: "ev-example",
      },
    ],
    pendingClaims: [],
    links: [
      { id: "link-1", fromRoomId: "entry", toRoomId: "living", note: "示例：从玄关向南走进客厅", continuousWalk: true, evidenceId: "ev-example" },
      { id: "link-2", fromRoomId: "living", toRoomId: "bedroom", note: "示例：客厅东侧进入主卧", continuousWalk: true, evidenceId: "ev-example" },
    ],
    pendingRelations: [],
    elevator: {
      near: "yes",
      relativeToEntry: "示例：入户门以东的公共走廊，不在套内。",
      adjacentRoomIds: ["entry"],
      sharedWallNote: "示例：与玄关之间隔着公共走廊，不是套内隔墙。",
      doorFacingDeg: 270,
      distanceM: 4,
      machineRoom: "beside",
      noiseNote: "示例：关门时有短促一声，夜间听得见。",
      vibrationNote: "示例：未感到床铺振动。",
      x: 10.6,
      y: 6.2,
      widthM: 1.7,
      depthM: 1.8,
      rotationDeg: 0,
      corridor: { x: 9.4, y: 6.0, widthM: 1.1, depthM: 2.2 },
    },
    notes: "示例旁白，不是真实住宅。从入户进来，门朝北。往南是客厅，客厅东侧是主卧。",
    evidence: [
      {
        id: "ev-example",
        kind: "narration",
        example: true,
        text: "示例旁白：入户门向外朝北；主卧东窗向外，方位角 90 度。连续从玄关走到客厅再进主卧。",
      },
    ],
    advanced: {
      sitting: null,
      sittingConfirmed: false,
      buildingYear: null,
      yearConfirmed: false,
      doorVsInterior: "unknown",
    },
    provenance: [
      {
        source: "内置示例",
        url: "",
        detail: "虚构数据，只为演示编辑、电梯问题和报告结构。",
      },
    ],
    ai: {
      analyzed: false,
      provider: null,
      destinationHost: null,
      note: "示例不是视频分析结果。",
    },
    underlayNote: "",
  };
}

export function incompleteExample(): Project {
  const project = exampleProject();
  project.id = "example-incomplete";
  project.title = "示例：电梯情况不完整";
  project.frame = "unlinked";
  project.compassConfirmed = false;
  project.plusYBearingDeg = null;
  project.claims = [
    {
      id: "claim-only-bed",
      roomId: "bedroom",
      wall: "east",
      azimuthDeg: 90,
      reference: "示例：只知道主卧东窗朝东。",
      status: "confirmed",
      evidenceId: "ev-example",
    },
  ];
  project.elevator = {
    ...project.elevator,
    near: "unknown",
    relativeToEntry: "",
    adjacentRoomIds: [],
    sharedWallNote: "",
    doorFacingDeg: null,
    distanceM: null,
    machineRoom: "",
    noiseNote: "",
    vibrationNote: "",
  };
  return project;
}
