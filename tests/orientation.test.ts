import { describe, expect, it } from "vitest";
import { exampleProject } from "../src/domain/example";
import { rotatePoint, wallOutwardBearing } from "../src/domain/geometry";
import { resolveOrientations } from "../src/domain/orientation";
import { applyNarration, createProject } from "../src/domain/project";

describe("朝向", () => {
  it("把平面罗盘旋转 90 度时，墙的向外方位跟着变，房间坐标不变", () => {
    const project = exampleProject();
    const x = project.rooms[0].x;
    expect(wallOutwardBearing(0, "east")).toBe(90);
    project.claims = [];
    project.plusYBearingDeg = 90;
    const resolution = resolveOrientations(project);
    expect(resolution.plusYBearingDeg).toBe(90);
    expect(resolution.rooms.bedroom.known).toBe(true);
    expect(wallOutwardBearing(resolution.plusYBearingDeg ?? 0, "east")).toBe(180);
    expect(project.rooms[0].x).toBe(x);
    const turned = rotatePoint(1, 0, 0, 0, 90);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(-1);
  });

  it("罗盘和已经确认的墙向冲突时，不采用旋转后的北", () => {
    const project = exampleProject();
    project.plusYBearingDeg = 90;
    const resolution = resolveOrientations(project);
    expect(resolution.plusYBearingDeg).toBeNull();
    expect(resolution.contradictions.join("")).toContain("对不上");
  });

  it("同一张已确认平面上，一面墙的方位可以锚定其他房间的墙向，但不移动它们", () => {
    const project = exampleProject();
    project.compassConfirmed = false;
    project.plusYBearingDeg = null;
    project.claims = [project.claims[1]];
    const before = project.rooms.map((room) => ({ ...room }));
    const resolution = resolveOrientations(project);
    expect(resolution.plusYBearingDeg).toBeCloseTo(0);
    expect(resolution.rooms.living.known).toBe(true);
    expect(resolution.rooms.bedroom.known).toBe(true);
    expect(resolution.rooms.living.reason).toContain("同一张");
    expect(project.rooms).toEqual(before);
  });

  it("只有一个房间的朝向时，不判断其他房间的位置和墙向", () => {
    const project = exampleProject();
    project.frame = "unlinked";
    project.compassConfirmed = false;
    project.plusYBearingDeg = null;
    project.claims = [
      {
        id: "only",
        roomId: "bedroom",
        wall: "east",
        azimuthDeg: 90,
        reference: "只提到主卧",
        status: "confirmed",
        evidenceId: "ev",
      },
    ];
    const resolution = resolveOrientations(project);
    expect(resolution.rooms.bedroom.known).toBe(true);
    expect(resolution.rooms.living.known).toBe(false);
    expect(resolution.rooms.kitchen.known).toBe(false);
    expect(resolution.rooms.living.reason).toContain("不能推出");
    expect(resolution.questions.join("")).toContain("不会据此排列其他房间");
  });

  it("互相矛盾的朝向不会被折中成一个北", () => {
    const project = exampleProject();
    project.claims[1] = { ...project.claims[1], azimuthDeg: 180 };
    const resolution = resolveOrientations(project);
    expect(resolution.contradictions.length).toBeGreaterThan(0);
    expect(resolution.rooms.living.known).toBe(false);
    expect(resolution.plusYBearingDeg).toBeNull();
  });

  it("旁白摘录不创造房间尺寸", () => {
    const project = applyNarration(createProject(), "主卧窗户朝南。我正对着窗户向外。家里挺舒服。厨房在客厅的南侧。");
    expect(project.rooms).toHaveLength(0);
    expect(project.pendingClaims).toHaveLength(1);
    expect(project.pendingClaims[0].roomName).toBe("主卧");
    expect(project.pendingClaims[0].azimuthDeg).toBe(180);
    expect(project.pendingRelations).toHaveLength(1);
    expect(project.ai.analyzed).toBe(false);
    expect(project.ai.note).toContain("没有视觉模型");
  });
});
