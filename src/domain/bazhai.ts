import { bearingOfVector } from "./geometry";
import type { Room, Trigram } from "./types";
import { areaWeightedCenter } from "./geometry";

export const TRIGRAMS: Trigram[] = ["坎", "艮", "震", "巽", "离", "坤", "兑", "乾"];

/** 后天八卦顺时针。口诀从坐山的下一位开始读。 */
const CLOCKWISE: Trigram[] = ["坎", "艮", "震", "巽", "离", "坤", "兑", "乾"];

const MNEMONIC: Record<Trigram, string> = {
  乾: "六天五祸绝延生",
  坎: "五天生延绝祸六",
  艮: "六绝祸生延天五",
  震: "延生祸绝五天六",
  巽: "天五六祸生绝延",
  离: "六五绝延祸生天",
  坤: "天延绝生祸五六",
  兑: "生祸延绝六五天",
};

const STAR: Record<string, string> = {
  生: "生气",
  延: "延年",
  天: "天医",
  六: "六煞",
  五: "五鬼",
  祸: "祸害",
  绝: "绝命",
};

export const FOUR_AUSPICIOUS = new Set(["生气", "延年", "天医", "伏位"]);

/**
 * 大游年只作可核对的文化标签。
 * 口诀是通行转述；《阳宅十书》OCR 不可靠，所以这里写明算法，而不是假装抄自某一页。
 */
export function youNianChart(sitting: Trigram): Record<Trigram, string> {
  const start = CLOCKWISE.indexOf(sitting);
  const chart = {} as Record<Trigram, string>;
  chart[sitting] = "伏位";
  const line = MNEMONIC[sitting];
  for (let i = 0; i < 7; i += 1) {
    const trigram = CLOCKWISE[(start + 1 + i) % 8];
    chart[trigram] = STAR[line[i]] ?? "未识别";
  }
  return chart;
}

export function mnemonicLine(sitting: Trigram): string {
  return `${sitting}${MNEMONIC[sitting]}`;
}

/** 方位角（0 北，顺时针）落入的 45 度卦宫。边界归入顺时针的下一宫，并可由调用方弃用过近的中心。 */
export function sectorTrigram(bearingDeg: number): Trigram {
  const deg = ((bearingDeg % 360) + 360) % 360;
  const shifted = (deg + 22.5) % 360;
  const index = Math.floor(shifted / 45);
  return CLOCKWISE[index];
}

export function roomSector(rooms: Room[], room: Room): { trigram: Trigram; ambiguous: boolean; reason: string } | null {
  const center = areaWeightedCenter(rooms);
  if (!center) return null;
  const rc = { x: room.x + room.widthM / 2, y: room.y + room.heightM / 2 };
  const dx = rc.x - center.x;
  const dy = rc.y - center.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.6) {
    return { trigram: "坎", ambiguous: true, reason: "房间中心离全宅面积中心太近，扇区不稳定。" };
  }
  return {
    trigram: sectorTrigram(bearingOfVector(dx, dy)),
    ambiguous: false,
    reason: "按房间中心相对全宅面积中心的方位归入 45 度卦宫。",
  };
}

export function yuanPeriod(year: number): { name: string; years: string } | null {
  if (!Number.isInteger(year)) return null;
  // 维基百科「九宫飞星图」：下元七运 1984–2003，其后每 20 年一运，180 年一轮。
  const origin = 1984;
  const offset = year - origin;
  const cycle = 180;
  let shifted = offset % cycle;
  if (shifted < 0) shifted += cycle;
  const index = Math.floor(shifted / 20);
  const names = ["七运", "八运", "九运", "一运", "二运", "三运", "四运", "五运", "六运"];
  const base = year - shifted;
  return { name: names[index], years: `${base + index * 20}–${base + index * 20 + 19}` };
}
