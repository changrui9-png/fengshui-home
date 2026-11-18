import { describe, expect, it } from "vitest";
import { rectsOverlap } from "../src/domain/geometry";
import { exampleProject } from "../src/domain/example";
import { applyGesture, balconyOnWall, moveOpening, openingSegment, placePreset, resizeCentered, resizeOpening, ROOM_PRESETS } from "../src/domain/planEdit";
import { createProject } from "../src/domain/project";
import { renderPlanSvg } from "../src/ui/planSvg";

describe("手绘编辑", () => {
  it("可以拖动并改变男主人房，名称留在房间上", () => {
    const project = createProject();
    const room = placePreset(project, "男主人房");
    const placed = { ...project, rooms: [room] };
    const moved = applyGesture(placed, { kind: "move-room", id: room.id, dx: 1.04, dy: -0.46 });
    expect(moved.rooms[0].name).toBe("男主人房");
    expect(moved.rooms[0].x).toBeCloseTo(1);
    expect(moved.rooms[0].y).toBeCloseTo(-0.5);
    expect(moved.rooms[0].widthM).toBe(room.widthM);
    const resized = applyGesture(moved, { kind: "resize-room", id: room.id, handle: "e", dx: 1, dy: 0 });
    expect(resized.rooms[0].widthM).toBeCloseTo(moved.rooms[0].widthM + 1);
    expect(resized.rooms[0].x).toBeCloseTo(moved.rooms[0].x);
    expect(resized.rooms[0].name).toBe("男主人房");
    expect(renderPlanSvg(resized)).toContain("男主人房");
  });

  it("门是一段可见的墙洞，能沿墙移动并改变宽度", () => {
    const room = { id: "living", name: "客厅", usage: "living" as const, x: 0, y: 0, widthM: 4, heightM: 3, rotationDeg: 0 };
    const opening = { id: "door", kind: "door" as const, roomId: "living", wall: "south" as const, offset: 0.5, widthM: 0.9, isMainEntry: false };
    const segment = openingSegment(room, opening);
    expect(segment.x2 - segment.x1).toBeCloseTo(0.9);
    expect(segment.y1).toBeCloseTo(segment.y2);
    const project = { ...createProject(), rooms: [room], openings: [opening] };
    const moved = applyGesture(project, { kind: "move-opening", id: "door", deltaAlong: 0.4 });
    expect(moved.openings[0].offset).toBeGreaterThan(opening.offset);
    expect(moved.openings[0].widthM).toBeCloseTo(0.9);
    const wider = applyGesture(project, { kind: "resize-opening", id: "door", deltaAlong: 0.3 });
    expect(wider.openings[0].widthM).toBeCloseTo(1.2);
    const svg = renderPlanSvg(project);
    expect(svg).toContain('data-kind="door"');
    expect(svg).not.toContain('data-kind="door"><circle');
    expect(moveOpening(room, opening, 0).widthM).toBeCloseTo(0.9);
    expect(resizeOpening(room, opening, 0).widthM).toBeCloseTo(0.9);
  });

  it("阳台贴在女主人房外侧，厕所是卫生间", () => {
    const host = placePreset(createProject(), "女主人房");
    const balcony = balconyOnWall(host, "north");
    expect(balcony.name).toBe("阳台");
    expect(balcony.usage).toBe("balcony");
    expect(balcony.y).toBeCloseTo(host.y + host.heightM);
    expect(
      rectsOverlap(
        { x: host.x, y: host.y, widthM: host.widthM, depthM: host.heightM },
        { x: balcony.x, y: balcony.y, widthM: balcony.widthM, depthM: balcony.heightM },
        0,
      ),
    ).toBe(false);
    const toilet = placePreset({ ...createProject(), rooms: [host] }, "厕所");
    expect(toilet.usage).toBe("bath");
    expect(toilet.name).toBe("厕所");
    expect(ROOM_PRESETS.map((item) => item.name)).toEqual(
      expect.arrayContaining(["男主人房", "女主人房", "儿童房", "客房", "客厅", "厨房", "卫生间", "书房", "餐厅", "入户", "厕所"]),
    );
  });

  it("家具改变大小时对边保持不动，电梯拖动带着走廊", () => {
    const next = resizeCentered({ x: 2, y: 2, width: 2, depth: 1 }, "e", 0.5, 0);
    expect(next.x - next.width / 2).toBeCloseTo(1);
    expect(next.width).toBeCloseTo(2.5);
    const project = exampleProject();
    const gap = project.elevator.corridor!.x - project.elevator.x;
    const moved = applyGesture(project, { kind: "move-elevator", dx: 1, dy: 0 });
    expect(moved.elevator.x).toBeCloseTo(project.elevator.x + 1);
    expect(moved.elevator.corridor!.x - moved.elevator.x).toBeCloseTo(gap);
  });
});
