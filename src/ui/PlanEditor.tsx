import { useState } from "react";
import { placeElevatorOutside } from "../domain/project";
import { uid } from "../domain/ids";
import type { FurnishingKind, Project, RoomUsage, WallSide } from "../domain/types";
import { FURNITURE_LABEL, USAGE_LABEL, WALL_LABEL } from "../domain/types";
import { renderPlanSvg } from "./planSvg";

const USAGES = Object.keys(USAGE_LABEL) as RoomUsage[];
const KINDS = Object.keys(FURNITURE_LABEL) as FurnishingKind[];
const WALLS = Object.keys(WALL_LABEL) as WallSide[];

export function PlanEditor({ project, setProject }: { project: Project; setProject: (project: Project) => void }) {
  const [selected, setSelected] = useState<string | null>(project.rooms[0]?.id ?? null);
  const room = project.rooms.find((item) => item.id === selected);
  const furnishing = project.furnishings.find((item) => item.id === selected);
  const opening = project.openings.find((item) => item.id === selected);

  function addRoom() {
    const id = uid("room");
    const offset = project.rooms.length * 0.4;
    setProject({
      ...project,
      rooms: [
        ...project.rooms,
        { id, name: "新房间", usage: "other", x: offset, y: offset, widthM: 3, heightM: 3, rotationDeg: 0 },
      ],
    });
    setSelected(id);
  }

  function addOpening(kind: "door" | "window") {
    const host = room ?? project.rooms[0];
    if (!host) return;
    const id = uid(kind);
    setProject({
      ...project,
      openings: [...project.openings, { id, kind, roomId: host.id, wall: "south", offset: 0.5, widthM: kind === "door" ? 0.9 : 1.2, isMainEntry: false }],
    });
    setSelected(id);
  }

  function addFurnishing(kind: FurnishingKind) {
    const host = room ?? project.rooms[0];
    if (!host) return;
    const id = uid(kind);
    setProject({
      ...project,
      furnishings: [
        ...project.furnishings,
        { id, kind, roomId: host.id, x: host.x + host.widthM / 2, y: host.y + host.heightM / 2, widthM: 1.2, depthM: 0.8, rotationDeg: 0 },
      ],
    });
    setSelected(id);
  }

  function removeSelected() {
    if (!selected) return;
    setProject({
      ...project,
      rooms: project.rooms.filter((item) => item.id !== selected),
      openings: project.openings.filter((item) => item.id !== selected && item.roomId !== selected),
      furnishings: project.furnishings.filter((item) => item.id !== selected && item.roomId !== selected),
      claims: project.claims.filter((item) => item.roomId !== selected),
    });
    setSelected(null);
  }

  return (
    <div className="layout">
      <div>
        <div className="grid-actions no-print" style={{ marginBottom: "0.5rem" }}>
          <button type="button" onClick={addRoom}>添加房间</button>
          <button type="button" onClick={() => addOpening("door")}>添加门</button>
          <button type="button" onClick={() => addOpening("window")}>添加窗</button>
          <button type="button" onClick={removeSelected} className="danger">删除选中</button>
          <button type="button" onClick={() => setProject(placeElevatorOutside(project))}>把电梯放到套外</button>
        </div>
        <div className="grid-actions no-print">
          {KINDS.map((kind) => (
            <button key={kind} type="button" onClick={() => addFurnishing(kind)}>
              添加{FURNITURE_LABEL[kind]}
            </button>
          ))}
        </div>
        <div
          className="plan-wrap"
          onClick={(event) => {
            const id = (event.target as Element).closest?.("[data-id]")?.getAttribute("data-id");
            if (id) setSelected(id);
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: renderPlanSvg(project, selected) }} />
        </div>
      </div>
      <aside className="card">
        <h2>坐标与确认</h2>
        <p className="small">{project.scaleMode === "measured" ? project.scaleNote : "示意图：移动和尺寸都是相对格子，不是测量。"}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={project.frame === "shared-plan"}
            onChange={(event) => setProject({ ...project, frame: event.target.checked ? "shared-plan" : "unlinked" })}
          />
          <span>这些房间在同一张平面上，相对位置是我确认的。</span>
        </label>
        <label className="field">
          平面向上对应的罗盘方位（0 为北）
          <input
            aria-label="平面向上的罗盘方位"
            type="number"
            value={project.plusYBearingDeg ?? ""}
            onChange={(event) =>
              setProject({
                ...project,
                plusYBearingDeg: event.target.value === "" ? null : Number(event.target.value),
              })
            }
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={project.compassConfirmed}
            onChange={(event) => setProject({ ...project, compassConfirmed: event.target.checked })}
          />
          <span>我确认这是整张图的北，不是猜测。</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={project.ownerConfirmation.topology}
            onChange={(event) => setProject({ ...project, ownerConfirmation: { ...project.ownerConfirmation, topology: event.target.checked } })}
          />
          <span>确认房间拓扑</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={project.ownerConfirmation.orientation}
            onChange={(event) => setProject({ ...project, ownerConfirmation: { ...project.ownerConfirmation, orientation: event.target.checked } })}
          />
          <span>确认朝向</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={project.ownerConfirmation.furniture}
            onChange={(event) => setProject({ ...project, ownerConfirmation: { ...project.ownerConfirmation, furniture: event.target.checked } })}
          />
          <span>确认家具</span>
        </label>
        {room ? (
          <>
            <h3>{room.name}</h3>
            <label className="field">名称<input type="text" value={room.name} onChange={(event) => updateRoom(project, setProject, room.id, { name: event.target.value })} /></label>
            <label className="field">
              用途
              <select value={room.usage} onChange={(event) => updateRoom(project, setProject, room.id, { usage: event.target.value as RoomUsage })}>
                {USAGES.map((usage) => (
                  <option key={usage} value={usage}>{USAGE_LABEL[usage]}</option>
                ))}
              </select>
            </label>
            {numberRow("横坐标 x", room.x, (x) => updateRoom(project, setProject, room.id, { x }))}
            {numberRow("纵坐标 y", room.y, (y) => updateRoom(project, setProject, room.id, { y }))}
            {numberRow("宽", room.widthM, (widthM) => updateRoom(project, setProject, room.id, { widthM }))}
            {numberRow("深", room.heightM, (heightM) => updateRoom(project, setProject, room.id, { heightM }))}
            {numberRow("旋转", room.rotationDeg, (rotationDeg) => updateRoom(project, setProject, room.id, { rotationDeg }))}
          </>
        ) : null}
        {furnishing ? (
          <>
            <h3>{FURNITURE_LABEL[furnishing.kind]}</h3>
            {numberRow("横坐标 x", furnishing.x, (x) => updateItem(project, setProject, furnishing.id, { x }))}
            {numberRow("纵坐标 y", furnishing.y, (y) => updateItem(project, setProject, furnishing.id, { y }))}
            {numberRow("旋转", furnishing.rotationDeg, (rotationDeg) => updateItem(project, setProject, furnishing.id, { rotationDeg }))}
          </>
        ) : null}
        {opening ? (
          <>
            <h3>{opening.kind === "door" ? "门" : "窗"}</h3>
            <label className="field">
              所在墙
              <select value={opening.wall} onChange={(event) => updateOpening(project, setProject, opening.id, { wall: event.target.value as WallSide })}>
                {WALLS.map((wall) => (
                  <option key={wall} value={wall}>{WALL_LABEL[wall]}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={opening.isMainEntry === true} onChange={(event) => updateOpening(project, setProject, opening.id, { isMainEntry: event.target.checked })} />
              <span>这是入户门</span>
            </label>
          </>
        ) : null}
        <h3>进阶流派所需资料</h3>
        <p className="small">留空就会不起盘。不要把某一扇窗填成整宅坐山，除非你确认整栋或整户的坐向就是它。</p>
        <label className="field">
          整宅坐山
          <select
            value={project.advanced.sitting ?? ""}
            onChange={(event) =>
              setProject({
                ...project,
                advanced: { ...project.advanced, sitting: (event.target.value || null) as Project["advanced"]["sitting"], sittingConfirmed: false },
              })
            }
          >
            <option value="">未填</option>
            {["坎", "艮", "震", "巽", "离", "坤", "兑", "乾"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={project.advanced.sittingConfirmed}
            onChange={(event) => setProject({ ...project, advanced: { ...project.advanced, sittingConfirmed: event.target.checked } })}
          />
          <span>我确认这是整宅坐山，不是单间窗户的朝向。</span>
        </label>
        <label className="field">
          建造或入伙年份
          <input
            aria-label="建造或入伙年份"
            type="number"
            value={project.advanced.buildingYear ?? ""}
            onChange={(event) =>
              setProject({
                ...project,
                advanced: {
                  ...project.advanced,
                  buildingYear: event.target.value === "" ? null : Number(event.target.value),
                  yearConfirmed: false,
                },
              })
            }
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={project.advanced.yearConfirmed}
            onChange={(event) => setProject({ ...project, advanced: { ...project.advanced, yearConfirmed: event.target.checked } })}
          />
          <span>我确认这是建造或入伙年份，不是今年。</span>
        </label>
        <label className="field">
          门与宅内的相对印象
          <select
            value={project.advanced.doorVsInterior}
            onChange={(event) =>
              setProject({
                ...project,
                advanced: { ...project.advanced, doorVsInterior: event.target.value as Project["advanced"]["doorVsInterior"] },
              })
            }
          >
            <option value="unknown">不知道，不要根据图面猜测</option>
            <option value="door-larger">门相对宅内偏大</option>
            <option value="door-smaller-or-similar">门并不大于宅内</option>
          </select>
        </label>
        <h3>待落实的朝向</h3>
        {project.pendingClaims.length === 0 ? <p className="small">没有尚未落墙的朝向。</p> : null}
        {project.pendingClaims.map((claim) => (
          <PendingClaimForm key={claim.id} project={project} setProject={setProject} claimId={claim.id} />
        ))}
      </aside>
    </div>
  );
}

function PendingClaimForm({
  project,
  setProject,
  claimId,
}: {
  project: Project;
  setProject: (project: Project) => void;
  claimId: string;
}) {
  const claim = project.pendingClaims.find((item) => item.id === claimId);
  const [roomId, setRoomId] = useState(project.rooms[0]?.id ?? "");
  const [wall, setWall] = useState<WallSide>("north");
  if (!claim) return null;
  return (
    <div>
      <p>{claim.roomName}：向外 {Math.round(claim.azimuthDeg)}°。{claim.reference}</p>
      <label className="field">
        落到房间
        <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
          {project.rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        墙
        <select value={wall} onChange={(event) => setWall(event.target.value as WallSide)}>
          {WALLS.map((item) => (
            <option key={item} value={item}>{WALL_LABEL[item]}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          if (!roomId) return;
          setProject({
            ...project,
            claims: [
              ...project.claims,
              {
                id: uid("claim"),
                roomId,
                wall,
                azimuthDeg: claim.azimuthDeg,
                reference: claim.reference,
                status: "stated",
                evidenceId: claim.evidenceId,
              },
            ],
            pendingClaims: project.pendingClaims.filter((item) => item.id !== claim.id),
          });
        }}
      >
        记到这面墙上（仍待确认）
      </button>
    </div>
  );
}

function numberRow(label: string, value: number, onChange: (value: number) => void) {
  return (
    <label className="field">
      {label}
      <input
        aria-label={label}
        type="number"
        step="0.1"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function updateRoom(project: Project, setProject: (project: Project) => void, id: string, patch: Partial<Project["rooms"][number]>) {
  setProject({ ...project, rooms: project.rooms.map((room) => (room.id === id ? { ...room, ...patch } : room)) });
}

function updateItem(project: Project, setProject: (project: Project) => void, id: string, patch: Partial<Project["furnishings"][number]>) {
  setProject({ ...project, furnishings: project.furnishings.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
}

function updateOpening(project: Project, setProject: (project: Project) => void, id: string, patch: Partial<Project["openings"][number]>) {
  setProject({ ...project, openings: project.openings.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
}
