import { elevatorOverlapsHome } from "../domain/elevator";
import { FURNITURE_LABEL, type Furnishing, type Project } from "../domain/types";

const SCALE = 42;

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

export function renderPlanSvg(project: Project, selectedId: string | null = null): string {
  const boxes = [
    ...project.rooms.map((room) => ({ x: room.x, y: room.y, w: room.widthM, h: room.heightM })),
    { x: project.elevator.x, y: project.elevator.y, w: project.elevator.widthM, h: project.elevator.depthM },
  ];
  if (project.elevator.corridor) {
    boxes.push({
      x: project.elevator.corridor.x,
      y: project.elevator.corridor.y,
      w: project.elevator.corridor.widthM,
      h: project.elevator.corridor.depthM,
    });
  }
  let minX = Math.min(...boxes.map((box) => box.x));
  let minY = Math.min(...boxes.map((box) => box.y));
  let maxX = Math.max(...boxes.map((box) => box.x + box.w));
  let maxY = Math.max(...boxes.map((box) => box.y + box.h));
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 8;
    maxY = 6;
  }
  minX -= 1;
  minY -= 1;
  maxX += 1.6;
  maxY += 1.4;
  const width = (maxX - minX) * SCALE;
  const height = (maxY - minY) * SCALE;
  const sx = (x: number) => (x - minX) * SCALE;
  const sy = (y: number) => (maxY - y) * SCALE;

  const grid: string[] = [];
  for (let x = Math.ceil(minX); x <= maxX; x += 1) {
    grid.push(`<line x1="${sx(x)}" y1="0" x2="${sx(x)}" y2="${height}" stroke="#e4d9c8" stroke-width="1"/>`);
  }
  for (let y = Math.ceil(minY); y <= maxY; y += 1) {
    grid.push(`<line x1="0" y1="${sy(y)}" x2="${width}" y2="${sy(y)}" stroke="#e4d9c8" stroke-width="1"/>`);
  }

  const overlap = elevatorOverlapsHome(project.elevator, project.rooms);
  const showShaft = project.elevator.near !== "no";
  const outside = showShaft
    ? renderOutside(project, sx, sy, overlap)
    : "";

  const rooms = project.rooms
    .map((room) => {
      const cx = sx(room.x + room.widthM / 2);
      const cy = sy(room.y + room.heightM / 2);
      const selected = selectedId === room.id;
      return `<g transform="rotate(${room.rotationDeg} ${cx} ${cy})">
        <rect data-id="${escapeXml(room.id)}" x="${sx(room.x)}" y="${sy(room.y + room.heightM)}" width="${room.widthM * SCALE}" height="${room.heightM * SCALE}" fill="${fillFor(room.usage)}" stroke="${selected ? "#8f2d2d" : "#2b241f"}" stroke-width="${selected ? 3 : 1.5}"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" font-size="15" fill="#1f1a17">${escapeXml(room.name)}</text>
      </g>`;
    })
    .join("");

  const openings = project.openings
    .map((opening) => {
      const room = project.rooms.find((item) => item.id === opening.roomId);
      if (!room) return "";
      const point = openingPoint(room, opening.wall, opening.offset);
      const x = sx(point.x);
      const y = sy(point.y);
      const color = opening.kind === "window" ? "#2f6f9f" : "#8f2d2d";
      const label = opening.isMainEntry ? "户门" : opening.kind === "window" ? "窗" : "门";
      return `<g data-id="${escapeXml(opening.id)}"><circle cx="${x}" cy="${y}" r="5" fill="${color}"/><text x="${x + 8}" y="${y - 6}" font-size="11" fill="${color}">${label}</text></g>`;
    })
    .join("");

  const furniture = project.furnishings
    .map((item) => {
      const selected = selectedId === item.id;
      return `<g data-id="${escapeXml(item.id)}" transform="translate(${sx(item.x)} ${sy(item.y)}) rotate(${item.rotationDeg})">
        <title>${escapeXml(FURNITURE_LABEL[item.kind])}</title>
        ${symbol(item)}
        ${selected ? `<rect x="${-item.widthM * SCALE * 0.5 - 4}" y="${-item.depthM * SCALE * 0.5 - 4}" width="${item.widthM * SCALE + 8}" height="${item.depthM * SCALE + 8}" fill="none" stroke="#8f2d2d" stroke-width="2"/>` : ""}
      </g>`;
    })
    .join("");

  const compass = compassRose(width - 70, 70, project.plusYBearingDeg);
  const scaleLabel = project.scaleMode === "measured" ? "已声明为实测" : "示意图，不是实测";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="住宅示意图" font-family="WenQuanYi Micro Hei, Noto Sans CJK SC, sans-serif">
  <rect width="100%" height="100%" fill="#fffdf8"/>
  ${grid.join("")}
  ${outside}
  ${rooms}
  ${openings}
  ${furniture}
  ${compass}
  <text x="16" y="${height - 16}" font-size="13" fill="#5c534c">${escapeXml(scaleLabel)}。向上的一边对应罗盘 ${project.plusYBearingDeg == null ? "尚未设定" : `${Math.round(project.plusYBearingDeg)}°`}。</text>
</svg>`;
}

function renderOutside(
  project: Project,
  sx: (x: number) => number,
  sy: (y: number) => number,
  overlap: boolean,
): string {
  const stroke = overlap ? "#8f2d2d" : "#1f4d3a";
  const elevator = project.elevator;
  const parts: string[] = [];
  if (elevator.corridor) {
    const corridor = elevator.corridor;
    parts.push(
      `<rect x="${sx(corridor.x)}" y="${sy(corridor.y + corridor.depthM)}" width="${corridor.widthM * SCALE}" height="${corridor.depthM * SCALE}" fill="none" stroke="${stroke}" stroke-dasharray="6 4" stroke-width="2"/>`,
      `<text x="${sx(corridor.x + corridor.widthM / 2)}" y="${sy(corridor.y + corridor.depthM / 2)}" text-anchor="middle" font-size="12" fill="${stroke}">走廊·套外</text>`,
    );
  }
  parts.push(
    `<rect data-id="elevator" x="${sx(elevator.x)}" y="${sy(elevator.y + elevator.depthM)}" width="${elevator.widthM * SCALE}" height="${elevator.depthM * SCALE}" fill="#e7f0ea" stroke="${stroke}" stroke-dasharray="5 3" stroke-width="2"/>`,
    `<text x="${sx(elevator.x + elevator.widthM / 2)}" y="${sy(elevator.y + elevator.depthM / 2)}" text-anchor="middle" font-size="13" fill="${stroke}">电梯·套外</text>`,
  );
  return parts.join("");
}

function openingPoint(room: Project["rooms"][number], wall: Project["openings"][number]["wall"], offset: number): { x: number; y: number } {
  switch (wall) {
    case "north":
      return { x: room.x + offset * room.widthM, y: room.y + room.heightM };
    case "south":
      return { x: room.x + offset * room.widthM, y: room.y };
    case "east":
      return { x: room.x + room.widthM, y: room.y + offset * room.heightM };
    case "west":
      return { x: room.x, y: room.y + offset * room.heightM };
  }
}

function fillFor(usage: Project["rooms"][number]["usage"]): string {
  switch (usage) {
    case "bedroom":
      return "#f3e4d4";
    case "kitchen":
      return "#f7ead2";
    case "bath":
      return "#e3eef2";
    case "entry":
      return "#efe7da";
    default:
      return "#f7f1e6";
  }
}

function symbol(item: Furnishing): string {
  const w = item.widthM * SCALE;
  const d = item.depthM * SCALE;
  const body = `<rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" fill="#fff" stroke="#2b241f" stroke-width="1.4"/>`;
  if (item.kind === "bed") {
    return `${body}<rect x="${-w / 2}" y="${d / 2 - 8}" width="${w}" height="8" fill="#8f2d2d"/>`;
  }
  if (item.kind === "sofa") return `${body}<rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="7" fill="#1f4d3a"/>`;
  if (item.kind === "dining-table") return `<ellipse cx="0" cy="0" rx="${w / 2}" ry="${d / 2}" fill="#fff" stroke="#2b241f"/>`;
  if (item.kind === "stove") return `${body}<circle cx="-6" cy="-4" r="3" fill="none" stroke="#8f2d2d"/><circle cx="6" cy="4" r="3" fill="none" stroke="#8f2d2d"/>`;
  if (item.kind === "sink") return `${body}<circle cx="0" cy="0" r="5" fill="none" stroke="#2f6f9f"/>`;
  if (item.kind === "mirror") return `<rect x="${-w / 2}" y="${-3}" width="${w}" height="6" fill="#d7e7f5" stroke="#2f6f9f"/>`;
  if (item.kind === "toilet") return `<ellipse cx="0" cy="4" rx="${w / 3}" ry="${d / 3}" fill="#fff" stroke="#2b241f"/><rect x="${-w / 4}" y="${-d / 2}" width="${w / 2}" height="8" fill="none" stroke="#2b241f"/>`;
  return body;
}

function compassRose(x: number, y: number, plusY: number | null): string {
  const rotation = plusY == null ? 0 : -plusY;
  const caption = plusY == null ? "北未定" : "北";
  return `<g transform="translate(${x} ${y}) rotate(${rotation})">
    <circle r="28" fill="#fffdf8" stroke="#8a6a32" stroke-width="2"/>
    <polygon points="0,-22 -6,8 0,4 6,8" fill="#8f2d2d"/>
    <text y="-30" text-anchor="middle" font-size="13" fill="#8f2d2d">${caption}</text>
  </g>`;
}

export async function downloadText(filename: string, content: string, type: string): Promise<void> {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function svgToPng(svg: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("无法建立画布"));
        return;
      }
      context.fillStyle = "#fffdf8";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((png) => {
        URL.revokeObjectURL(url);
        if (!png) reject(new Error("无法导出 PNG"));
        else resolve(png);
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法绘制 SVG"));
    };
    image.src = url;
  });
}
