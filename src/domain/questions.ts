import { elevatorQuestions } from "./elevator";
import { resolveOrientations } from "./orientation";
import type { Clarification, Project } from "./types";

export function clarificationQuestions(project: Project): Clarification[] {
  const list: Clarification[] = [];
  const orientation = resolveOrientations(project);

  if (project.scaleMode === "schematic") {
    list.push({
      id: "scale",
      topic: "scale",
      text: "当前是示意图。除非你改成「已实测」并填写依据，否则报告里的米数只表示格子上的相对长短。",
    });
  }

  if (project.pendingClaims.length > 0) {
    list.push({
      id: "pending-claim",
      topic: "orientation",
      text: "旁白里有朝向，但还没有落到某一面墙上。请在平面上画出对应房间，指定窗户或门在哪一侧，再确认。在这之前，这条朝向不会转动其他房间。",
    });
  }

  for (const question of orientation.questions) {
    list.push({ id: `ori-${list.length}`, topic: "orientation", text: question });
  }
  for (const contradiction of orientation.contradictions) {
    list.push({ id: `con-${list.length}`, topic: "orientation", text: contradiction });
  }

  if (project.frame === "unlinked" && project.rooms.length > 1) {
    list.push({
      id: "frame",
      topic: "layout",
      text: "这些房间还没有被确认为同一张平面。只知道其中一间的朝向时，不会排列其他房间。请勾选「相对位置已确认」，或补充连续走访。",
    });
  }

  if (project.pendingRelations.length > 0) {
    list.push({
      id: "pending-rel",
      topic: "layout",
      text: "旁白提到了谁在谁的哪一侧，但没有尺寸。这只保留为相邻关系，不会自动画出房间。",
    });
  }

  if (project.rooms.length === 0) {
    list.push({
      id: "no-rooms",
      topic: "layout",
      text: "还没有房间。可以手绘、导入 JSON，或把 video-to-3d 的 scene.json 读入为一间未定向的房间。",
    });
  }

  if (project.furnishings.length === 0 && project.rooms.length > 0) {
    list.push({
      id: "no-furniture",
      topic: "furniture",
      text: "还没有床、沙发、书桌、餐桌、灶、水槽、镜子或马桶。相关规则会保持证据不足。",
    });
  }

  for (const question of elevatorQuestions(project)) {
    list.push({ id: question.id, topic: "elevator", text: question.text });
  }

  if (!project.advanced.sittingConfirmed || !project.advanced.yearConfirmed) {
    list.push({
      id: "advanced",
      topic: "advanced",
      text: "八宅需要你确认的整宅坐山；玄空飞星还需要建造或入伙年份和二十四山。缺这些就不起盘，不会用单扇窗或今年的年份代替。",
    });
  }

  if (!project.ai.analyzed) {
    list.push({
      id: "ai",
      topic: "ai",
      text: project.ai.note || "自动视频解读需要在服务器配置模型密钥。当前没有声称视频已被分析。",
    });
  }

  return list;
}
