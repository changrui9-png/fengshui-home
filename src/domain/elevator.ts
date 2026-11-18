import { angleDiff, footprintBounds, rectsOverlap } from "./geometry";
import type { ElevatorState, Project, Room, RuleResult } from "./types";
import { SOURCES } from "./sources";

export function emptyElevator(): ElevatorState {
  return {
    near: "unknown",
    relativeToEntry: "",
    adjacentRoomIds: [],
    sharedWallNote: "",
    doorFacingDeg: null,
    distanceM: null,
    machineRoom: "",
    noiseNote: "",
    vibrationNote: "",
    x: 0,
    y: 0,
    widthM: 1.7,
    depthM: 1.8,
    rotationDeg: 0,
    corridor: null,
  };
}

export function suggestElevatorOutside(rooms: Room[]): Pick<ElevatorState, "x" | "y" | "widthM" | "depthM" | "corridor"> {
  const bounds = footprintBounds(rooms);
  const widthM = 1.7;
  const depthM = 1.8;
  if (!bounds) {
    return { x: 3, y: 0, widthM, depthM, corridor: { x: 1.4, y: 0, widthM: 1.4, depthM: 2.2 } };
  }
  const gap = 0.6;
  const corridorW = 1.2;
  const corridor = {
    x: bounds.maxX + gap,
    y: bounds.maxY - Math.max(depthM, 2.2),
    widthM: corridorW,
    depthM: Math.max(depthM, 2.2),
  };
  return {
    x: corridor.x + corridor.widthM + 0.15,
    y: corridor.y,
    widthM,
    depthM,
    corridor,
  };
}

export function elevatorOverlapsHome(elevator: ElevatorState, rooms: Room[]): boolean {
  const box = { x: elevator.x, y: elevator.y, widthM: elevator.widthM, depthM: elevator.depthM };
  const corridor = elevator.corridor
    ? {
        x: elevator.corridor.x,
        y: elevator.corridor.y,
        widthM: elevator.corridor.widthM,
        depthM: elevator.corridor.depthM,
      }
    : null;
  return rooms.some((room) => {
    const home = { x: room.x, y: room.y, widthM: room.widthM, depthM: room.heightM };
    return rectsOverlap(box, home, 0.02) || (corridor != null && rectsOverlap(corridor, home, 0.02));
  });
}

export interface ElevatorQuestion {
  id: string;
  text: string;
}

export function elevatorQuestions(project: Project): ElevatorQuestion[] {
  const elevator = project.elevator;
  if (elevator.near === "no") return [];
  const questions: ElevatorQuestion[] = [];
  if (elevator.near === "unknown") {
    questions.push({
      id: "elev-near",
      text: "这套住宅是否靠近电梯？请回答是、否，或仍然不清楚。不清楚时不会写电梯结论。",
    });
  }
  if (!elevator.relativeToEntry.trim()) {
    questions.push({ id: "elev-entry", text: "电梯相对入户门在哪个位置？例如门外左侧、对门、走廊尽头。" });
  }
  if (elevator.adjacentRoomIds.length === 0 && !elevator.sharedWallNote.trim()) {
    questions.push({ id: "elev-adjacent", text: "电梯或电梯走廊与哪些房间相邻，或与哪面墙之间只隔公共走廊？不知道就保持空白。" });
  }
  if (elevator.doorFacingDeg == null) {
    questions.push({ id: "elev-door", text: "电梯门朝哪一面打开？请给罗盘方位，或说明它是否正对户门。不知道就不要猜。" });
  }
  if (elevator.distanceM == null) {
    questions.push({ id: "elev-distance", text: "如果知道户门到电梯门的大约距离，请填写米数。不知道可以留空，与距离有关的判断会保持空白。" });
  }
  if (!elevator.machineRoom) {
    questions.push({ id: "elev-machine", text: "电梯机房在住宅上方、旁边、其他位置，还是没有，或不清楚？" });
  }
  if (!elevator.noiseNote.trim()) {
    questions.push({ id: "elev-noise", text: "请记下实际听到的电梯声音。若没注意过，请写「未观察」，不要留空，也不要写成没有声音。" });
  }
  if (!elevator.vibrationNote.trim()) {
    questions.push({ id: "elev-vibration", text: "请记下是否感到振动。若没注意过，请写「未观察」。" });
  }
  if ((elevator.near === "yes" || elevator.near === "unknown") && elevatorOverlapsHome(elevator, project.rooms) && project.rooms.length > 0) {
    questions.push({ id: "elev-outside", text: "电梯和走廊画进了住宅外轮廓里面。请把它们移到套外，否则不使用这张位置做结论。" });
  }
  return questions;
}

function base(partial: Omit<RuleResult, "source" | "school"> & { school: RuleResult["school"]; source: RuleResult["source"] }): RuleResult {
  return partial;
}

export function elevatorRuleResults(project: Project, entryBearing: number | null): RuleResult[] {
  const elevator = project.elevator;
  const questions = elevatorQuestions(project);
  const missing = questions.map((item) => item.text);

  if (elevator.near === "no") {
    return [
      base({
        id: "FS-ELEV-DOOR-001",
        title: "电梯门与户门的相对方位",
        school: "popular-contemporary",
        status: "not-applicable",
        confidence: "none",
        why: "业主确认住宅不靠近电梯，因此不评估电梯门与户门的关系。",
        conditions: ["靠近电梯：否"],
        evidence: ["业主选择了「不靠近电梯」。"],
        source: SOURCES.elevatorPopular,
      }),
      base({
        id: "PR-ELEV-ENV-001",
        title: "电梯噪声、振动、隐私与到达",
        school: "practical",
        status: "not-applicable",
        confidence: "none",
        why: "业主确认不靠近电梯，没有可记录的电梯噪声、振动或视线问题。",
        conditions: ["靠近电梯：否"],
        evidence: ["业主选择了「不靠近电梯」。"],
        practicalNote: "若以后改变看法，需要重新填写位置和亲耳听到的情况。",
        source: SOURCES.practical,
      }),
    ];
  }

  const overlap = project.rooms.length > 0 && elevatorOverlapsHome(elevator, project.rooms);
  const locationReady =
    elevator.relativeToEntry.trim() &&
    (elevator.adjacentRoomIds.length > 0 || elevator.sharedWallNote.trim()) &&
    elevator.doorFacingDeg != null &&
    !overlap;
  const traditionalReady = elevator.near === "yes" && locationReady && entryBearing != null;

  const traditional: RuleResult = traditionalReady
    ? (() => {
        const diff = angleDiff(elevator.doorFacingDeg as number, entryBearing as number);
        const opposite = diff > 150;
        return base({
          id: "FS-ELEV-DOOR-001",
          title: "电梯门与户门的相对方位",
          school: "popular-contemporary",
          status: "evaluated",
          confidence: "low",
          why: "户门向外的方位和电梯门的方位都已由业主填写，且电梯画在套外。这里只比较两个方位角。",
          conditions: ["靠近电梯：是", "户门方位已知", "电梯门方位已知", "相对位置和相邻关系已填", "图形在套外"],
          evidence: [
            `户门向外方位角 ${Math.round(entryBearing as number)}°。`,
            `电梯门向外方位角 ${Math.round(elevator.doorFacingDeg as number)}°，夹角约 ${Math.round(diff)}°。`,
            `相对入户：${elevator.relativeToEntry.trim()}`,
          ],
          culturalNote: opposite
            ? "当代通俗说法有时把正对的电梯门和户门称作「门冲」。电梯不见于《宅经》，这条不是古籍结论，也不能当成灾祸预测。"
            : "按业主填写的方位，电梯门与户门并不是大致正对。通俗说法里的「门冲」在这组方位上不成立。",
          rearrangement: opposite
            ? "若只是不想开门就看见电梯门，可以考虑门内屏风或换开门方向。这是视线安排，不是化煞。"
            : "不必为了这条通俗说法移动户门。",
          source: SOURCES.elevatorPopular,
        });
      })()
    : base({
        id: "FS-ELEV-DOOR-001",
        title: "电梯门与户门的相对方位",
        school: "popular-contemporary",
        status: "withheld",
        confidence: "none",
        why:
          elevator.near === "unknown"
            ? "还不能确定住宅是否靠近电梯，所以不写电梯门与户门的任何具体关系。"
            : entryBearing == null
              ? "户门自己的向外方位还没有确认，不能比较它和电梯门。"
              : overlap
                ? "电梯或走廊与套内重叠，位置无效，不据此下结论。"
                : "电梯相对入户的位置、相邻关系或电梯门朝向仍缺少业主填写的内容。",
        conditions: ["需要明确靠近电梯，并同时具备户门方位、电梯门方位、相对位置和相邻关系"],
        evidence: missing.length ? missing : ["条件未凑齐。"],
        source: SOURCES.elevatorPopular,
      });

  const envReady =
    elevator.near === "yes" &&
    elevator.noiseNote.trim() &&
    elevator.vibrationNote.trim() &&
    elevator.machineRoom &&
    elevator.machineRoom !== "unknown" &&
    elevator.distanceM != null &&
    !overlap;

  const practical: RuleResult = envReady
    ? base({
        id: "PR-ELEV-ENV-001",
        title: "电梯噪声、振动、隐私与到达",
        school: "practical",
        status: "evaluated",
        confidence: "medium",
        why: "这些句子只转述业主写下的观察和距离，不把它们解释成风水吉凶。",
        conditions: ["靠近电梯：是", "已填写噪声、振动、机房和距离", "图形在套外"],
        evidence: [
          `噪声：${elevator.noiseNote.trim()}`,
          `振动：${elevator.vibrationNote.trim()}`,
          `机房：${machineLabel(elevator.machineRoom)}`,
          `业主填写的距离：${elevator.distanceM} 米。`,
        ],
        practicalNote: privacyNote(elevator, entryBearing),
        rearrangement: "若噪声或振动已经影响睡眠，优先考虑门窗密封、床远离共用墙，或向物业查询轿厢与导轨。这与罗盘无关。",
        source: SOURCES.practical,
      })
    : base({
        id: "PR-ELEV-ENV-001",
        title: "电梯噪声、振动、隐私与到达",
        school: "practical",
        status: "withheld",
        confidence: "none",
        why: "噪声、振动、机房或距离还有空项，或是否靠近电梯仍不清楚。缺少的观察不会被补成「没有问题」。",
        conditions: ["需要业主自己的噪声、振动、机房和距离记录"],
        evidence: missing.length ? missing : ["条件未凑齐。"],
        practicalNote: "未观察不等于安静，也不等于有振动。",
        source: SOURCES.practical,
      });

  return [traditional, practical];
}

function machineLabel(value: ElevatorState["machineRoom"]): string {
  switch (value) {
    case "above":
      return "住宅上方";
    case "beside":
      return "住宅旁边";
    case "other":
      return "其他位置";
    case "none":
      return "没有机房";
    default:
      return "未填";
  }
}

function privacyNote(elevator: ElevatorState, entryBearing: number | null): string {
  if (entryBearing == null || elevator.doorFacingDeg == null || elevator.distanceM == null) {
    return "户门与电梯门是否形成对视，还缺少方位或距离。";
  }
  const opposite = angleDiff(elevator.doorFacingDeg, entryBearing) > 150;
  if (opposite && elevator.distanceM <= 6) {
    return `两门方位大致相对，业主填写的距离约 ${elevator.distanceM} 米。开门时走廊上的人可能看见室内，这是隐私问题。`;
  }
  return "按已填方位，两门不是近距离正对。隐私仍取决于猫眼、门的开启方向和走廊是否有人停留。";
}
