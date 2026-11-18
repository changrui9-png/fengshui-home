export interface TranscriptParse {
  claims: { roomName: string; azimuthDeg: number; quote: string }[];
  relations: { fromName: string; toName: string; quote: string }[];
  elevatorNear: { value: "yes" | "no" | "unknown"; quote: string } | null;
  warnings: string[];
}

const ROOM = "主卧|次卧|客厅|餐厅|厨房|书房|卫生间|厕所|阳台|玄关|入户|卧室";

const DIR: Record<string, number> = {
  北: 0,
  东北: 45,
  东: 90,
  东南: 135,
  南: 180,
  西南: 225,
  西: 270,
  西北: 315,
};

function sentences(text: string): string[] {
  return text
    .split(/[。！？\n；;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function roomNames(sentence: string): string[] {
  return sentence.match(new RegExp(ROOM, "g")) ?? [];
}

function directionIn(sentence: string): { azimuth: number; conflict: boolean } | null {
  const azimuth = sentence.match(/方位角\s*(\d+(?:\.\d+)?)/);
  const word = sentence.match(/(?:朝|向)(东北|东南|西北|西南|东|南|西|北)/);
  if (azimuth && word) {
    const deg = Number(azimuth[1]);
    const named = DIR[word[1]];
    const diff = Math.min(Math.abs(deg - named), 360 - Math.abs(deg - named));
    return { azimuth: deg, conflict: diff > 25 };
  }
  if (azimuth) return { azimuth: Number(azimuth[1]), conflict: false };
  if (word) return { azimuth: DIR[word[1]], conflict: false };
  return null;
}

/**
 * 只摘录旁白里写明的房间名、方位和相邻关系。
 * 不创造尺寸，不把一个房间的朝向抄到另一个房间。
 */
export function parseNarration(text: string): TranscriptParse {
  const claims: TranscriptParse["claims"] = [];
  const relations: TranscriptParse["relations"] = [];
  const warnings: string[] = [];
  let elevatorNear: TranscriptParse["elevatorNear"] = null;

  for (const sentence of sentences(text)) {
    if (/电梯/.test(sentence)) {
      if (/不靠近电梯|没有电梯|无电梯/.test(sentence)) elevatorNear = { value: "no", quote: sentence };
      else if (/不清楚|不知道|不确定/.test(sentence) && /电梯/.test(sentence)) elevatorNear = { value: "unknown", quote: sentence };
      else if (/靠近电梯|有电梯|电梯在|电梯位于/.test(sentence)) elevatorNear = { value: "yes", quote: sentence };
      else warnings.push(`提到了电梯，但没有说明是否靠近：「${sentence}」`);
    }

    const names = [...new Set(roomNames(sentence))];
    const facing = directionIn(sentence);
    const looksLikeDirection = /朝|向|方位角|窗户|窗/.test(sentence) && facing;
    if (looksLikeDirection && facing) {
      if (facing.conflict) {
        warnings.push(`方位角和方向词对不上，这句不采用：「${sentence}」`);
      } else if (names.length !== 1) {
        warnings.push(`这句有方向，但没有唯一的房间名，因此不采用：「${sentence}」`);
      } else {
        claims.push({ roomName: names[0], azimuthDeg: facing.azimuth, quote: sentence });
      }
    }

    const relation = sentence.match(new RegExp(`(${ROOM})在(${ROOM})的?(东|南|西|北)侧`));
    if (relation) {
      relations.push({
        fromName: relation[1],
        toName: relation[2],
        quote: sentence,
      });
    }
  }

  return { claims, relations, elevatorNear, warnings };
}
