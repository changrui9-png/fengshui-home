export const SCHEMA_VERSION = 1 as const;

export type WallSide = "north" | "east" | "south" | "west";

export type RoomUsage =
  | "entry"
  | "living"
  | "bedroom"
  | "kitchen"
  | "bath"
  | "dining"
  | "study"
  | "balcony"
  | "other";

export type FurnishingKind =
  | "bed"
  | "sofa"
  | "desk"
  | "dining-table"
  | "stove"
  | "sink"
  | "mirror"
  | "toilet"
  | "wardrobe"
  | "tv";

export type Trigram = "坎" | "艮" | "震" | "巽" | "离" | "坤" | "兑" | "乾";

export type RuleStatus = "evaluated" | "not-applicable" | "insufficient-evidence" | "withheld";

export type ConfidenceLabel = "high" | "medium" | "low" | "none";

export interface Room {
  id: string;
  name: string;
  usage: RoomUsage;
  x: number;
  y: number;
  widthM: number;
  heightM: number;
  rotationDeg: number;
}

export interface Opening {
  id: string;
  kind: "door" | "window";
  roomId: string;
  wall: WallSide;
  /** 0 到 1，沿墙从西端或南端量起。 */
  offset: number;
  widthM: number;
  isMainEntry?: boolean;
}

export interface Furnishing {
  id: string;
  kind: FurnishingKind;
  roomId: string;
  x: number;
  y: number;
  widthM: number;
  depthM: number;
  rotationDeg: number;
}

export interface OrientationClaim {
  id: string;
  roomId: string;
  wall: WallSide;
  /** 该墙向外的罗盘方位角，0 为正北，90 为正东。 */
  azimuthDeg: number;
  reference: string;
  status: "confirmed" | "stated";
  evidenceId: string;
}

export interface PendingClaim {
  id: string;
  roomName: string;
  azimuthDeg: number;
  reference: string;
  evidenceId: string;
}

export interface AdjacencyLink {
  id: string;
  fromRoomId: string;
  toRoomId: string;
  note: string;
  continuousWalk: boolean;
  evidenceId: string;
}

export interface PendingRelation {
  id: string;
  fromName: string;
  toName: string;
  note: string;
  evidenceId: string;
}

export interface EvidenceItem {
  id: string;
  kind: "narration" | "plan" | "owner" | "import" | "photo" | "ai-hypothesis";
  text: string;
  /** 示例或外部工具的数据要标明，不能写成业主住宅的事实。 */
  example: boolean;
}

export interface ElevatorState {
  near: "yes" | "no" | "unknown";
  relativeToEntry: string;
  adjacentRoomIds: string[];
  sharedWallNote: string;
  doorFacingDeg: number | null;
  distanceM: number | null;
  machineRoom: "" | "above" | "beside" | "other" | "none" | "unknown";
  noiseNote: string;
  vibrationNote: string;
  x: number;
  y: number;
  widthM: number;
  depthM: number;
  rotationDeg: number;
  corridor: { x: number; y: number; widthM: number; depthM: number } | null;
}

export interface Project {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  example: boolean;
  /** 未实测时必须保持 schematic，规则不得把格子当成真实长度。 */
  scaleMode: "schematic" | "measured";
  scaleNote: string;
  /**
   * shared-plan：房间画在同一张已确认的相对平面上。
   * unlinked：只有名单或口述，没有可共用的相对位置。
   */
  frame: "shared-plan" | "unlinked";
  /** 平面 +y（向北的屏幕上方）所对的罗盘方位。null 表示还没有整图罗盘。 */
  plusYBearingDeg: number | null;
  compassConfirmed: boolean;
  ownerConfirmation: {
    topology: boolean;
    orientation: boolean;
    furniture: boolean;
  };
  rooms: Room[];
  openings: Opening[];
  furnishings: Furnishing[];
  claims: OrientationClaim[];
  pendingClaims: PendingClaim[];
  links: AdjacencyLink[];
  pendingRelations: PendingRelation[];
  elevator: ElevatorState;
  notes: string;
  evidence: EvidenceItem[];
  advanced: {
    sitting: Trigram | null;
    /** 业主明确这是整宅坐山，而不是某一扇窗的朝向。 */
    sittingConfirmed: boolean;
    buildingYear: number | null;
    yearConfirmed: boolean;
    doorVsInterior: "unknown" | "door-larger" | "door-smaller-or-similar";
  };
  provenance: { source: string; url: string; detail: string }[];
  ai: {
    analyzed: boolean;
    provider: string | null;
    destinationHost: string | null;
    note: string;
  };
  /** 仅作底图，不表示已经识别。 */
  underlayNote: string;
}

export interface SourceRef {
  title: string;
  url: string;
  edition: string;
  quotePolicy: string;
}

export interface RuleResult {
  id: string;
  title: string;
  school: "form-classical" | "eight-mansions" | "flying-star" | "popular-contemporary" | "practical";
  status: RuleStatus;
  confidence: ConfidenceLabel;
  why: string;
  conditions: string[];
  evidence: string[];
  culturalNote?: string;
  practicalNote?: string;
  rearrangement?: string;
  source: SourceRef;
}

export interface Clarification {
  id: string;
  topic: "orientation" | "layout" | "elevator" | "furniture" | "advanced" | "scale" | "ai";
  text: string;
}

export interface OrientationResolution {
  plusYBearingDeg: number | null;
  /** 每个房间是否已经有整房墙向。没有则不能写该房间的罗盘朝向。 */
  rooms: Record<string, { known: boolean; plusYBearingDeg: number | null; reason: string }>;
  contradictions: string[];
  questions: string[];
  anchoredFromClaim: boolean;
}

export const FURNITURE_LABEL: Record<FurnishingKind, string> = {
  bed: "床",
  sofa: "沙发",
  desk: "书桌",
  "dining-table": "餐桌",
  stove: "灶",
  sink: "水槽",
  mirror: "镜子",
  toilet: "马桶",
  wardrobe: "衣柜",
  tv: "电视",
};

export const USAGE_LABEL: Record<RoomUsage, string> = {
  entry: "入户",
  living: "客厅",
  bedroom: "卧室",
  kitchen: "厨房",
  bath: "卫生间",
  dining: "餐厅",
  study: "书房",
  balcony: "阳台",
  other: "其他",
};

export const WALL_LABEL: Record<WallSide, string> = {
  north: "北侧墙",
  east: "东侧墙",
  south: "南侧墙",
  west: "西侧墙",
};
