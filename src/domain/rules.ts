import { mnemonicLine, roomSector, youNianChart, yuanPeriod, FOUR_AUSPICIOUS } from "./bazhai";
import { elevatorRuleResults } from "./elevator";
import {
  angleDiff,
  bearingOfVector,
  distancePointToRoomWalls,
  frontBearing,
  furnishingPoint,
  openingCenter,
  wallOutwardBearing,
} from "./geometry";
import { resolveOrientations, roomPlusY } from "./orientation";
import { SOURCES } from "./sources";
import type { Furnishing, Opening, Project, Room, RuleResult, WallSide } from "./types";

function rule(partial: RuleResult): RuleResult {
  return partial;
}

function roomById(project: Project, id: string): Room | undefined {
  return project.rooms.find((room) => room.id === id);
}

function mainEntry(project: Project): { room: Room; opening: Opening } | null {
  const opening = project.openings.find((item) => item.kind === "door" && item.isMainEntry);
  if (!opening) return null;
  const room = roomById(project, opening.roomId);
  if (!room) return null;
  return { room, opening };
}

export function entryOutwardBearing(project: Project): number | null {
  const entry = mainEntry(project);
  if (!entry) return null;
  const plusY = roomPlusY(resolveOrientations(project), entry.room.id);
  if (plusY == null) return null;
  return wallOutwardBearing(plusY, entry.opening.wall);
}

function items(project: Project, kind: Furnishing["kind"]): Furnishing[] {
  return project.furnishings.filter((item) => item.kind === kind);
}

export function evaluateRules(project: Project): RuleResult[] {
  const orientation = resolveOrientations(project);
  const entryBearing = (() => {
    const entry = mainEntry(project);
    if (!entry) return null;
    const plusY = roomPlusY(orientation, entry.room.id);
    if (plusY == null) return null;
    return wallOutwardBearing(plusY, entry.opening.wall);
  })();

  return [
    doorCrown(project, entryBearing),
    fiveEmptiness(project),
    fudeWithheld(project),
    eightMansions(project, orientation),
    flyingStars(project),
    bedRule(project),
    mirrorRule(project),
    bathDoorRule(project),
    stoveRule(project),
    daylightRule(project),
    circulationRule(project),
    ventilationRule(project),
    ...elevatorRuleResults(project, entryBearing),
  ];
}

function doorCrown(project: Project, entryBearing: number | null): RuleResult {
  const entry = mainEntry(project);
  if (!entry) {
    return rule({
      id: "FS-ZJ-001",
      title: "门户为宅之冠带",
      school: "form-classical",
      status: "insufficient-evidence",
      confidence: "none",
      why: "图上没有标成入户门的门。没有门，就不能讨论宅经里的门户。",
      conditions: ["需要一扇由业主标出的入户门"],
      evidence: [],
      source: SOURCES.zhaijing,
    });
  }
  return rule({
    id: "FS-ZJ-001",
    title: "门户为宅之冠带",
    school: "form-classical",
    status: "evaluated",
    confidence: entryBearing == null ? "low" : "medium",
    why: "入户门已经标出。本条只说明传统文本把门户当作宅的「冠带」，不给吉凶，也不因门的朝向打分。",
    conditions: ["存在已标注的入户门"],
    evidence: [
      `入户门在「${entry.room.name}」的${wallName(entry.opening.wall)}。`,
      entryBearing == null ? "这扇门所在房间还没有确认的罗盘墙向。" : `门向外的方位角约为 ${Math.round(entryBearing)}°。`,
    ],
    culturalNote: "《宅经》卷上以形势比身体，其中说门户如同冠带。这是文化比喻。",
    practicalNote: "入户门前应留出能打开并通行的位置，便于日常进出。这是动线，不是气运。",
    source: SOURCES.zhaijing,
  });
}

function fiveEmptiness(project: Project): RuleResult {
  if (project.advanced.doorVsInterior === "unknown") {
    return rule({
      id: "FS-ZJ-002",
      title: "五虚中的「宅门大内小」",
      school: "form-classical",
      status: "insufficient-evidence",
      confidence: "none",
      why: "示意图上的门宽和房间格子不能用来判断门是否大于宅内。业主没有单独确认这项比例。",
      conditions: ["需要业主明确选择门与宅内的相对大小，而不是从示意图推算"],
      evidence: [project.scaleMode === "schematic" ? "当前比例是示意图。" : "即使标了实测，本条仍只接受业主的直接选择。"],
      source: SOURCES.zhaijing,
    });
  }
  const larger = project.advanced.doorVsInterior === "door-larger";
  return rule({
    id: "FS-ZJ-002",
    title: "五虚中的「宅门大内小」",
    school: "form-classical",
    status: "evaluated",
    confidence: "low",
    why: "只转述业主自己的选择。传统文本把「宅门大内小」列为五虚之一，并与贫耗的说法连在一起；这里不把它当成经济预测。",
    conditions: ["业主已选择门与宅内的相对印象"],
    evidence: [larger ? "业主选择：门相对宅内偏大。" : "业主选择：门并不大于宅内。"],
    culturalNote: larger
      ? "按《宅经》的分类，这落在其所说的第二虚。分类本身是文化记录。"
      : "按业主的选择，这条五虚不成立。",
    source: SOURCES.zhaijing,
  });
}

function fudeWithheld(project: Project): RuleResult {
  const hasMoveOrigin = project.notes.includes("移来方位：") && project.advanced.sittingConfirmed;
  if (!hasMoveOrigin) {
    return rule({
      id: "FS-ZJ-003",
      title: "福德方与刑祸方",
      school: "form-classical",
      status: "withheld",
      confidence: "none",
      why: "《宅经》按搬来的方位分辨阴阳，再谈福德方与刑祸方。没有业主写下的移来方位，就不指定哪一面该拓、哪一面该缩。",
      conditions: ["需要业主在备注中写明「移来方位：……」，并确认整宅坐向"],
      evidence: ["未找到移来方位。"],
      source: SOURCES.zhaijing,
    });
  }
  return rule({
    id: "FS-ZJ-003",
    title: "福德方与刑祸方",
    school: "form-classical",
    status: "withheld",
    confidence: "none",
    why: "已经有移来方位的字样，但本版不自动把一句话换算成福德方。换算涉及阴阳宅图，错指一方就会整段失真，所以仍然不起具体方位。",
    conditions: ["有移来方位记录", "仍需人工对照宅经阴阳图，程序不代判"],
    evidence: ["备注里有移来方位，程序拒绝自动落位。"],
    source: SOURCES.zhaijing,
  });
}

function eightMansions(project: Project, orientation: ReturnType<typeof resolveOrientations>): RuleResult {
  if (!project.advanced.sitting || !project.advanced.sittingConfirmed) {
    return rule({
      id: "FS-BZ-001",
      title: "八宅大游年",
      school: "eight-mansions",
      status: "withheld",
      confidence: "none",
      why: "八宅用整宅坐山起伏位。某一间房的窗户朝向不能代替坐山，命卦和建造年份也不会被猜出来。",
      conditions: ["业主确认八卦坐山", "坐山必须是整宅，而不是单窗"],
      evidence: project.advanced.sitting
        ? ["坐山已填写，但业主还没有确认它是整宅坐山。"]
        : ["未填写坐山。"],
      source: SOURCES.wikipediaFengshui,
    });
  }
  if (project.frame !== "shared-plan" || Object.values(orientation.rooms).some((row) => !row.known)) {
    return rule({
      id: "FS-BZ-001",
      title: "八宅大游年",
      school: "eight-mansions",
      status: "insufficient-evidence",
      confidence: "none",
      why: "坐山已确认，但房间还不在同一张有罗盘的平面上，无法把房间放进卦宫。",
      conditions: ["已确认坐山", "还需要共用平面和罗盘锚点"],
      evidence: [`坐山：${project.advanced.sitting}。口诀转述为「${mnemonicLine(project.advanced.sitting)}」。`],
      culturalNote: "口诀按后天八卦顺时针、从坐山下一位起读。这是可复算的文化标签，不是吉凶事实。",
      source: SOURCES.yangzhai,
    });
  }
  const chart = youNianChart(project.advanced.sitting);
  const lines: string[] = [];
  for (const room of project.rooms) {
    const sector = roomSector(project.rooms, room);
    if (!sector || sector.ambiguous) {
      lines.push(`${room.name}：扇区不稳定，不分配游年星。`);
      continue;
    }
    const star = chart[sector.trigram];
    lines.push(`${room.name}：中心落在${sector.trigram}宫，传统标签是「${star}」。`);
  }
  return rule({
    id: "FS-BZ-001",
    title: "八宅大游年",
    school: "eight-mansions",
    status: "evaluated",
    confidence: "low",
    why: "坐山由业主确认，房间扇区来自已锚定的平面。星名只按写明的口诀算法标出。维基百科说明八宅是后世用于住宅的方位法，不是测量结论。",
    conditions: ["坐山已确认", "共用平面已有罗盘", "房间中心离全宅中心足够远"],
    evidence: [`口诀：${mnemonicLine(project.advanced.sitting)}。`, ...lines],
    culturalNote: `该派把${[...FOUR_AUSPICIOUS].join("、")}称作四吉。本报告不因此声称健康或财富会改变。`,
    rearrangement: "若只是想按这一派的习惯安排久留的位置，可把床或书桌移到你已确认、且标签为延年或天医的房间。不要为了星名封门窗或妨碍通行。",
    source: SOURCES.yangzhai,
  });
}

function flyingStars(project: Project): RuleResult {
  if (project.advanced.buildingYear == null || !project.advanced.yearConfirmed) {
    return rule({
      id: "FS-XK-001",
      title: "玄空飞星",
      school: "flying-star",
      status: "withheld",
      confidence: "none",
      why: "飞星需要建造或入伙年份来定元运，还需要罗盘上的二十四山。未提供建造或入伙年份，因此整条不起盘，也不用今年的运去代替建成年。",
      conditions: ["业主确认建造或入伙年份", "二十四山坐向与度数"],
      evidence: ["年份空缺。"],
      source: SOURCES.wikipediaStars,
    });
  }
  const period = yuanPeriod(project.advanced.buildingYear);
  return rule({
    id: "FS-XK-001",
    title: "玄空飞星",
    school: "flying-star",
    status: "withheld",
    confidence: "none",
    why: `年份可以对应维基百科表里的${period ? period.name + "（" + period.years + "）" : "未知运"}，但二十四山、替卦和空亡线都没有。山星和向星不起盘，房间里也不分配飞星。`,
    conditions: ["年份已确认", "仍缺少精确坐向"],
    evidence: [`业主确认的年份：${project.advanced.buildingYear}。`],
    culturalNote: "元运只说明传统历法把哪一年分到哪一运。它不是这套房子的运气评分。",
    source: SOURCES.wikipediaStars,
  });
}

function bedRule(project: Project): RuleResult {
  const beds = items(project, "bed");
  if (beds.length === 0) {
    return rule({
      id: "FS-POP-BED-001",
      title: "床与墙、床与门",
      school: "popular-contemporary",
      status: "insufficient-evidence",
      confidence: "none",
      why: "未标注床，所以不评价床头是否靠墙，也不评价床是否朝向门。",
      conditions: ["至少一个已标注的床"],
      evidence: [],
      source: SOURCES.popularForm,
    });
  }
  const evidence: string[] = [];
  for (const bed of beds) {
    const room = roomById(project, bed.roomId);
    if (!room) {
      evidence.push("有一张床没有对应房间。");
      continue;
    }
    const head = furnishingPoint(bed, 0, -bed.depthM / 2);
    const gap = distancePointToRoomWalls(room, head.x, head.y);
    const against = gap <= 0.45;
      const door = nearestDoor(project, bed);
    evidence.push(
      `${room.name}的床头${against ? "靠近" : "并未靠近"}房间墙面（约 ${gap.toFixed(2)} 米）。` +
        (door ? door.text : "同户没有可比较的门。"),
    );
  }
  return rule({
    id: "FS-POP-BED-001",
    title: "床与墙、床与门",
    school: "popular-contemporary",
    status: "evaluated",
    confidence: "low",
    why: "床和门的位置来自图上的坐标。文化解释没有核对到《宅经》专条，因此只作为通俗说法。",
    conditions: ["床已画在某个房间里"],
    evidence,
    culturalNote: "当代通俗峦头常建议床头靠实墙，并且床的正面不直对房门。这不是已核对的古籍引文。",
    practicalNote: "床头留出靠背、床边留出通道，会更容易上下床。门若直冲床，开门时也会直接看见床。",
    rearrangement: "可以把床沿墙平移，使床头贴墙，并让床的正面避开房门中线。请同时保留出门的通道。",
    source: SOURCES.popularForm,
  });
}

function nearestDoor(project: Project, bed: Furnishing): { text: string } | null {
  const doors = project.openings.filter((opening) => opening.kind === "door");
  if (doors.length === 0) return null;
  let best: { diff: number; opening: Opening; owner: Room } | null = null;
  for (const opening of doors) {
    const owner = roomById(project, opening.roomId);
    if (!owner) continue;
    const center = openingCenter(owner, opening);
    const bearing = bearingOfVector(center.x - bed.x, center.y - bed.y);
    const diff = angleDiff(frontBearing(bed), bearing);
    const dist = Math.hypot(center.x - bed.x, center.y - bed.y);
    if (dist > 6) continue;
    if (!best || diff < best.diff) best = { diff, opening, owner };
  }
  if (!best) return { text: "附近没有门。" };
  const aligned = best.diff <= 25;
  return {
    text: aligned
      ? `床的正面大致朝向「${best.owner.name}」的一扇门（夹角约 ${Math.round(best.diff)}°）。`
      : `床的正面并不朝向最近可比较的门（最小夹角约 ${Math.round(best.diff)}°）。`,
  };
}

function mirrorRule(project: Project): RuleResult {
  const mirrors = items(project, "mirror");
  const beds = items(project, "bed");
  if (mirrors.length === 0 || beds.length === 0) {
    return rule({
      id: "FS-POP-MIRROR-001",
      title: "镜子与床",
      school: "popular-contemporary",
      status: "insufficient-evidence",
      confidence: "none",
      why: "镜子或床有一项没有画上，不能判断镜面是否朝向床。",
      conditions: ["同时有镜子和床"],
      evidence: [],
      source: SOURCES.popularForm,
    });
  }
  const evidence: string[] = [];
  for (const mirror of mirrors) {
    for (const bed of beds) {
      const toBed = bearingOfVector(bed.x - mirror.x, bed.y - mirror.y);
      const diff = angleDiff(frontBearing(mirror), toBed);
      const dist = Math.hypot(bed.x - mirror.x, bed.y - mirror.y);
      if (dist > 8) continue;
      evidence.push(
        diff <= 30
          ? `一面镜子的正面朝向床，距离约 ${dist.toFixed(1)} 米，夹角约 ${Math.round(diff)}°。`
          : `一面镜子并不朝向这张床（夹角约 ${Math.round(diff)}°）。`,
      );
    }
  }
  if (evidence.length === 0) {
    return rule({
      id: "FS-POP-MIRROR-001",
      title: "镜子与床",
      school: "popular-contemporary",
      status: "insufficient-evidence",
      confidence: "none",
      why: "镜子和床距离太远，图上不能看成同一视线。",
      conditions: ["镜子与床相距不超过 8 米"],
      evidence: [],
      source: SOURCES.popularForm,
    });
  }
  return rule({
    id: "FS-POP-MIRROR-001",
    title: "镜子与床",
    school: "popular-contemporary",
    status: "evaluated",
    confidence: "low",
    why: "只比较镜面正面和床的位置。",
    conditions: ["镜子与床都已标注"],
    evidence,
    culturalNote: "通俗说法不主张镜子正对床。没有把它写成古典引文。",
    practicalNote: "镜面朝向床时，灯光会反射到枕边，躺下也能看见自己。这是光线和视线，不是健康诊断。",
    rearrangement: "可将镜子转到侧面，或在睡觉时遮住镜面。",
    source: SOURCES.popularForm,
  });
}

function bathDoorRule(project: Project): RuleResult {
  const baths = project.rooms.filter((room) => room.usage === "bath");
  const beds = items(project, "bed");
  const stoves = items(project, "stove");
  if (baths.length === 0 || (beds.length === 0 && stoves.length === 0)) {
    return rule({
      id: "FS-POP-BATHDOOR-001",
      title: "卫生间门对床或灶",
      school: "popular-contemporary",
      status: "insufficient-evidence",
      confidence: "none",
      why: baths.length === 0 ? "没有卫生间，无法讨论卫生间门的朝向。" : "没有床或灶，无法判断卫生间门是否朝向它们。",
      conditions: ["需要标出卫生间及其门"],
      evidence: [],
      source: SOURCES.popularForm,
    });
  }
  const evidence: string[] = [];
  for (const bath of baths) {
    const doors = project.openings.filter((opening) => opening.roomId === bath.id && opening.kind === "door");
    if (doors.length === 0) {
      evidence.push(`${bath.name}没有门，不能判断它朝向谁。`);
      continue;
    }
    for (const door of doors) {
      const center = openingCenter(bath, door);
      const plusY = roomPlusY(resolveOrientations(project), bath.id);
      const outward = plusY == null ? null : wallOutwardBearing(plusY, door.wall);
      for (const target of [...beds, ...stoves]) {
        const bearing = bearingOfVector(target.x - center.x, target.y - center.y);
        const geometric = angleDiff(bearing, outward ?? bearing);
        const faces = outward != null && geometric <= 25 && Math.hypot(target.x - center.x, target.y - center.y) < 5;
        const kind = target.kind === "bed" ? "床" : "灶";
        if (outward == null) {
          evidence.push(`${bath.name}的门还没有罗盘墙向，不能说它是否朝向${kind}。`);
        } else if (faces) {
          evidence.push(`${bath.name}的门向外大致朝向${kind}。`);
        } else {
          evidence.push(`${bath.name}的门向外并不朝向这处${kind}。`);
        }
      }
    }
  }
  return rule({
    id: "FS-POP-BATHDOOR-001",
    title: "卫生间门对床或灶",
    school: "popular-contemporary",
    status: "evaluated",
    confidence: "low",
    why: "只在卫生间、门、床或灶都已画出，并且墙向已知时比较方位。墙向未知的句子会明确说不能判断。",
    conditions: ["卫生间门", "床或灶", "该墙的罗盘方位"],
    evidence,
    culturalNote: "通俗说法避免厕门正对床或灶。此处不引用未核对的古书句子。",
    practicalNote: "厕门对床主要是气味、视线和隐私；对灶则是油烟与卫生习惯。两者都不是疾病或破财的原因说明。",
    source: SOURCES.popularForm,
  });
}

function stoveRule(project: Project): RuleResult {
  const stoves = items(project, "stove");
  const sinks = items(project, "sink");
  if (stoves.length === 0) {
    return rule({
      id: "FS-POP-STOVE-001",
      title: "灶与水槽",
      school: "popular-contemporary",
      status: "insufficient-evidence",
      confidence: "none",
      why: "未标注灶，不讨论灶的位置。",
      conditions: ["需要灶的位置"],
      evidence: [],
      source: SOURCES.popularForm,
    });
  }
  const evidence = stoves.flatMap((stove) => {
    return sinks.map((sink) => {
      const dist = Math.hypot(stove.x - sink.x, stove.y - sink.y);
      return `灶与水槽中心相距约 ${dist.toFixed(2)} 米。`;
    });
  });
  if (sinks.length === 0) evidence.push("没有水槽，不能比较灶和水。");
  return rule({
    id: "FS-POP-STOVE-001",
    title: "灶与水槽",
    school: "popular-contemporary",
    status: "evaluated",
    confidence: "low",
    why: "距离来自示意图或实测坐标，报告会写明当前比例类型。不把水火位置解释成财运。",
    conditions: ["灶已标注"],
    evidence: [`比例：${project.scaleMode === "measured" ? "业主标为实测" : "示意图，数字不是测量值"}。`, ...evidence],
    practicalNote: "水槽紧挨炉灶时，水容易溅到火焰和油锅上。做饭时保持台面可操作即可。",
    source: SOURCES.popularForm,
  });
}

function daylightRule(project: Project): RuleResult {
  if (project.rooms.length === 0) {
    return rule({
      id: "PR-LIGHT-001",
      title: "采光记录",
      school: "practical",
      status: "insufficient-evidence",
      confidence: "none",
      why: "没有房间，不能记录哪一间有窗。",
      conditions: ["房间与窗户"],
      evidence: [],
      source: SOURCES.practical,
    });
  }
  const evidence = project.rooms.map((room) => {
    const windows = project.openings.filter((opening) => opening.roomId === room.id && opening.kind === "window");
    return windows.length ? `${room.name}记录了 ${windows.length} 扇窗。室外遮挡未知，不能因此说它明亮。` : `${room.name}没有记录窗户，不能判断采光。`;
  });
  return rule({
    id: "PR-LIGHT-001",
    title: "采光记录",
    school: "practical",
    status: "evaluated",
    confidence: "medium",
    why: "只统计图上有没有窗。没有室外照片或遮挡信息时，不判断房间是否明亮。",
    conditions: ["按房间清点窗户记录"],
    evidence,
    practicalNote: "采光取决于朝向、窗面积、楼距和天气。风水标签不能替代这些。",
    source: SOURCES.practical,
  });
}

function circulationRule(project: Project): RuleResult {
  const blockers: string[] = [];
  for (const opening of project.openings.filter((item) => item.kind === "door")) {
    const room = roomById(project, opening.roomId);
    if (!room) continue;
    const center = openingCenter(room, opening);
    for (const item of project.furnishings) {
      const dist = Math.hypot(item.x - center.x, item.y - center.y);
      if (dist < 0.7) blockers.push(`${room.name}的门附近 ${dist.toFixed(2)} 米处有家具。`);
    }
  }
  if (project.openings.every((item) => item.kind !== "door")) {
    return rule({
      id: "PR-CIRC-001",
      title: "门口通道",
      school: "practical",
      status: "insufficient-evidence",
      confidence: "none",
      why: "没有门，无法检查门口是否被家具挡住。",
      conditions: ["门与家具"],
      evidence: [],
      source: SOURCES.practical,
    });
  }
  return rule({
    id: "PR-CIRC-001",
    title: "门口通道",
    school: "practical",
    status: "evaluated",
    confidence: "medium",
    why: "检查家具中心是否落在门中心 0.7 米以内。这是通行观察。",
    conditions: ["已画门和家具"],
    evidence: blockers.length ? blockers : ["没有家具中心落在门边 0.7 米以内。"],
    practicalNote: "门口堆物会妨碍开关门。紧急时也需要能打开入户门。",
    rearrangement: blockers.length ? "把门口 0.7 米内的家具挪开，留出开门和站人的位置。" : undefined,
    source: SOURCES.practical,
  });
}

function ventilationRule(project: Project): RuleResult {
  const kitchens = project.rooms.filter((room) => room.usage === "kitchen");
  if (kitchens.length === 0) {
    return rule({
      id: "PR-VENT-001",
      title: "厨房排烟记录",
      school: "practical",
      status: "insufficient-evidence",
      confidence: "none",
      why: "没有厨房，不讨论炉灶排烟。",
      conditions: ["厨房"],
      evidence: [],
      source: SOURCES.practical,
    });
  }
  const evidence = kitchens.map((room) => {
    const windows = project.openings.filter((opening) => opening.roomId === room.id && opening.kind === "window");
    return windows.length
      ? `${room.name}有窗的记录。窗不等于已经安装排烟道。`
      : `${room.name}没有窗户记录，不能判断如何排烟。`;
  });
  return rule({
    id: "PR-VENT-001",
    title: "厨房排烟记录",
    school: "practical",
    status: "evaluated",
    confidence: "low",
    why: "只根据有没有画出窗户来说明证据缺口，不引用具体消防规范编号。",
    conditions: ["厨房是否画了窗"],
    evidence,
    practicalNote: "炒菜需要可确认的排烟路径。请业主自行核对烟道，而不是用方位代替。",
    source: SOURCES.practical,
  });
}

function wallName(wall: WallSide): string {
  return { north: "北侧墙", east: "东侧墙", south: "南侧墙", west: "西侧墙" }[wall];
}

export function assessmentGate(project: Project): { finalAllowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!project.ownerConfirmation.topology) reasons.push("还没有确认房间是否相连、谁挨着谁。");
  if (!project.ownerConfirmation.orientation) reasons.push("还没有确认朝向是否按你的叙述或罗盘填写。");
  if (!project.ownerConfirmation.furniture) reasons.push("还没有确认床、沙发、灶等家具的位置。");
  return { finalAllowed: reasons.length === 0, reasons };
}
