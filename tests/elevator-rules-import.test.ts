import { describe, expect, it } from "vitest";
import { youNianChart, yuanPeriod } from "../src/domain/bazhai";
import { elevatorOverlapsHome, elevatorQuestions, suggestElevatorOutside } from "../src/domain/elevator";
import { exampleProject, incompleteExample } from "../src/domain/example";
import { exportProject, parseProject, parseProjectJson } from "../src/domain/importExport";
import { evaluateRules } from "../src/domain/rules";
import { importVideoTo3dScene } from "../src/domain/videoTo3d";
import { renderPlanSvg } from "../src/ui/planSvg";

describe("电梯", () => {
  it("信息不完整时追问，并 withholding 具体结论", () => {
    const project = incompleteExample();
    const questions = elevatorQuestions(project).map((item) => item.text).join("");
    expect(questions).toContain("是否靠近电梯");
    expect(questions).toContain("相对入户");
    expect(questions).toContain("电梯门朝");
    expect(questions).toContain("机房");
    expect(questions).toContain("未观察");
    const rules = evaluateRules(project);
    const traditional = rules.find((rule) => rule.id === "FS-ELEV-DOOR-001");
    const practical = rules.find((rule) => rule.id === "PR-ELEV-ENV-001");
    expect(traditional?.status).toBe("withheld");
    expect(practical?.status).toBe("withheld");
    expect(traditional?.why).toContain("不写电梯门");
  });

  it("确认不靠近电梯时，规则不适用", () => {
    const project = exampleProject();
    project.elevator.near = "no";
    const rules = evaluateRules(project);
    expect(rules.find((rule) => rule.id === "FS-ELEV-DOOR-001")?.status).toBe("not-applicable");
    expect(elevatorQuestions(project)).toHaveLength(0);
  });

  it("电梯和走廊默认画在套外，挪进房间会被判重叠", () => {
    const project = exampleProject();
    expect(elevatorOverlapsHome(project.elevator, project.rooms)).toBe(false);
    const suggested = suggestElevatorOutside(project.rooms);
    expect(elevatorOverlapsHome({ ...project.elevator, ...suggested }, project.rooms)).toBe(false);
    project.elevator.x = project.rooms[0].x;
    project.elevator.y = project.rooms[0].y;
    expect(elevatorOverlapsHome(project.elevator, project.rooms)).toBe(true);
    const svg = renderPlanSvg(exampleProject());
    expect(svg).toContain("电梯·套外");
    expect(svg).toContain("走廊·套外");
    expect(svg).toContain("主卧");
    expect(svg).toContain("示意图");
  });

  it("资料齐全时，门向关系与噪声观察分成两条", () => {
    const rules = evaluateRules(exampleProject());
    const traditional = rules.find((rule) => rule.id === "FS-ELEV-DOOR-001");
    const practical = rules.find((rule) => rule.id === "PR-ELEV-ENV-001");
    expect(traditional?.status).toBe("evaluated");
    expect(traditional?.culturalNote).toContain("不成立");
    expect(traditional?.culturalNote).not.toContain("必");
    expect(practical?.status).toBe("evaluated");
    expect(practical?.school).toBe("practical");
    expect(practical?.evidence.join("")).toContain("夜间听得见");
  });
});

describe("规则是否适用", () => {
  it("没有坐山和年份时，八宅与飞星都不起盘，并说明原因", () => {
    const rules = evaluateRules(exampleProject());
    const bazhai = rules.find((rule) => rule.id === "FS-BZ-001");
    const stars = rules.find((rule) => rule.id === "FS-XK-001");
    expect(bazhai?.status).toBe("withheld");
    expect(bazhai?.why).toContain("不能代替坐山");
    expect(stars?.status).toBe("withheld");
    expect(stars?.why).toContain("未提供建造或入伙年份");
    expect(stars?.why).not.toContain("九运");
  });

  it("有年份仍缺少二十四山时，只标明运名，不起房间飞星", () => {
    const project = exampleProject();
    project.advanced.buildingYear = 2010;
    project.advanced.yearConfirmed = true;
    const stars = evaluateRules(project).find((rule) => rule.id === "FS-XK-001");
    expect(stars?.status).toBe("withheld");
    expect(stars?.why).toContain("八运");
    expect(stars?.why).toContain("不起盘");
    expect(yuanPeriod(2010)?.name).toBe("八运");
    expect(yuanPeriod(2024)?.name).toBe("九运");
  });

  it("坐山确认后才给出可复算的游年标签", () => {
    expect(youNianChart("坎").巽).toBe("生气");
    expect(youNianChart("乾").兑).toBe("生气");
    const project = exampleProject();
    project.advanced.sitting = "坎";
    project.advanced.sittingConfirmed = true;
    const rule = evaluateRules(project).find((item) => item.id === "FS-BZ-001");
    expect(rule?.status).toBe("evaluated");
    expect(rule?.evidence.join("")).toContain("传统标签");
    expect(rule?.culturalNote).toContain("不因此声称");
  });

  it("没有床就不评价床，示意图不能推出宅门大小", () => {
    const project = exampleProject();
    project.furnishings = project.furnishings.filter((item) => item.kind !== "bed");
    const rules = evaluateRules(project);
    expect(rules.find((rule) => rule.id === "FS-POP-BED-001")?.why).toContain("未标注床");
    expect(rules.find((rule) => rule.id === "FS-ZJ-002")?.status).toBe("insufficient-evidence");
    expect(rules.find((rule) => rule.id === "FS-ZJ-002")?.why).toContain("不能用来判断");
  });
});

describe("导入", () => {
  it("项目 JSON 可以往返，并去掉尖括号", () => {
    const exported = exportProject(exampleProject());
    const parsed = parseProjectJson(exported);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.project.rooms).toHaveLength(5);
    expect(parsed.project.ai.analyzed).toBe(false);
    const dirty = JSON.parse(exported) as { title: string };
    dirty.title = "<script>alert(1)</script>";
    const cleaned = parseProject(dirty);
    expect(cleaned.ok).toBe(true);
    if (!cleaned.ok) return;
    expect(cleaned.project.title).not.toContain("<");
  });

  it("拒绝损坏的 JSON 和未知版本", () => {
    expect(parseProjectJson("{").ok).toBe(false);
    expect(parseProject({ schemaVersion: 9 }).ok).toBe(false);
  });

  it("video-to-3d 的矩形可以导入，但不会带上朝向", () => {
    const result = importVideoTo3dScene({
      scale_method: "camera height given: 1.5 m",
      room: { rect_m: [0, 0, 4.2, 3.1], incomplete: false, length_m: 4.2, width_m: 3.1 },
      confidence: { label: "medium" },
      warnings: ["示例夹具，不是真实测量"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.rooms).toHaveLength(1);
    expect(result.project.rooms[0].widthM).toBeCloseTo(4.2);
    expect(result.project.scaleMode).toBe("measured");
    expect(result.project.plusYBearingDeg).toBeNull();
    expect(result.project.frame).toBe("unlinked");
    expect(result.project.furnishings).toHaveLength(0);
    expect(result.warnings.join("")).toContain("没有朝向");
  });

  it("不完整的 scene.json 不编造边长", () => {
    const result = importVideoTo3dScene({ room: { incomplete: true, reason: "Opposite walls were not both captured" } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.rooms).toHaveLength(0);
    expect(result.warnings.join("")).toContain("Opposite walls");
  });
});
