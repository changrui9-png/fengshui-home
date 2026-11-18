import { assessmentGate, evaluateRules } from "../domain/rules";
import { clarificationQuestions } from "../domain/questions";
import type { Project, RuleResult } from "../domain/types";

const STATUS_LABEL: Record<RuleResult["status"], string> = {
  evaluated: "已评估",
  "not-applicable": "不适用",
  "insufficient-evidence": "证据不足",
  withheld: "暂不结论",
};

const CONFIDENCE_LABEL = { high: "信心高", medium: "信心中", low: "信心低", none: "无信心评分" };

export function ReportPanel({
  project,
  finalized,
  onFinalize,
}: {
  project: Project;
  finalized: boolean;
  onFinalize: () => void;
}) {
  const gate = assessmentGate(project);
  const rules = evaluateRules(project);
  const questions = clarificationQuestions(project);
  return (
    <section className="card" id="report">
      <h2>{finalized && gate.finalAllowed ? "最终评估" : "评估预览"}</h2>
      {finalized && gate.finalAllowed ? (
        <p className="banner ok" role="status">这是在你确认拓扑、朝向和家具之后生成的文本。它仍然不是健康或财富预测。</p>
      ) : (
        <p className="banner warn" role="status">这不是最终评估。请先在户型页确认房间拓扑、朝向和家具。</p>
      )}
      <p>传统段落是文化解读，附有可打开的文献或明确的通俗来源。实用段落只谈采光记录、通风、动线、噪声、振动和隐私。二者不会互相证明。</p>
      {!gate.finalAllowed ? (
        <ul>
          {gate.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <button className="primary no-print" type="button" disabled={!gate.finalAllowed} onClick={onFinalize}>
        生成最终评估
      </button>
      <h3>仍需核对</h3>
      <div className="questions">
        {questions.map((question) => (
          <article key={question.id}>
            <span className="tag">{question.topic}</span>
            <p>{question.text}</p>
          </article>
        ))}
      </div>
      <h3>规则</h3>
      {rules.map((rule) => (
        <article className="rule" key={rule.id}>
          <p>
            <span className={`status ${rule.status}`}>{STATUS_LABEL[rule.status]}</span>{" "}
            <span className="tag">{rule.id}</span> <span className="tag">{CONFIDENCE_LABEL[rule.confidence]}</span>
          </p>
          <h3>{rule.title}</h3>
          <p>{rule.why}</p>
          {rule.evidence.length ? (
            <ul>
              {rule.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {rule.culturalNote ? <p>文化解读：{rule.culturalNote}</p> : null}
          {rule.practicalNote ? <p>实用观察：{rule.practicalNote}</p> : null}
          {rule.rearrangement ? <p>可以考虑的调整：{rule.rearrangement}</p> : null}
          <p className="small">
            来源：{rule.source.url ? <a href={rule.source.url}>{rule.source.title}</a> : rule.source.title}。{rule.source.edition} {rule.source.quotePolicy}
          </p>
        </article>
      ))}
    </section>
  );
}

export function QuestionsPanel({ project }: { project: Project }) {
  const questions = clarificationQuestions(project);
  return (
    <section className="card">
      <h2>需要你补充的地方</h2>
      <p>下面只列出目前推不下去的问题。空白不会被填成确定事实。</p>
      <div className="questions">
        {questions.map((question) => (
          <article key={question.id}>
            <span className="tag">{question.topic}</span>
            <p>{question.text}</p>
          </article>
        ))}
      </div>
      <h3>证据</h3>
      {project.evidence.length === 0 ? <p>还没有记录。</p> : null}
      <ul>
        {project.evidence.map((item) => (
          <li key={item.id}>{item.example ? "［示例］" : ""}{item.text}</li>
        ))}
      </ul>
    </section>
  );
}

export function ElevatorPanel({ project, setProject }: { project: Project; setProject: (project: Project) => void }) {
  const elevator = project.elevator;
  function patch(partial: Partial<Project["elevator"]>) {
    setProject({ ...project, elevator: { ...elevator, ...partial } });
  }
  return (
    <section className="card">
      <h2>电梯</h2>
      <p>电梯和走廊画在住宅外轮廓之外。传统的门向关系和实际的噪声、振动、隐私分开写。缺一项，就不写依赖它的结论。</p>
      <label className="field">
        是否靠近电梯
        <select value={elevator.near} onChange={(event) => patch({ near: event.target.value as Project["elevator"]["near"] })}>
          <option value="unknown">不清楚</option>
          <option value="yes">是</option>
          <option value="no">否</option>
        </select>
      </label>
      {elevator.near !== "no" ? (
        <>
          <label className="field">相对入户的位置<textarea value={elevator.relativeToEntry} onChange={(event) => patch({ relativeToEntry: event.target.value })} /></label>
          <label className="field">共用墙或走廊说明<textarea value={elevator.sharedWallNote} onChange={(event) => patch({ sharedWallNote: event.target.value })} /></label>
          <label className="field">相邻房间
            <select
              multiple
              value={elevator.adjacentRoomIds}
              onChange={(event) => patch({ adjacentRoomIds: [...event.target.selectedOptions].map((option) => option.value) })}
            >
              {project.rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </label>
          <label className="field">电梯门向外的方位角<input type="number" value={elevator.doorFacingDeg ?? ""} onChange={(event) => patch({ doorFacingDeg: event.target.value === "" ? null : Number(event.target.value) })} /></label>
          <label className="field">距离（米，可空）<input type="number" value={elevator.distanceM ?? ""} onChange={(event) => patch({ distanceM: event.target.value === "" ? null : Number(event.target.value) })} /></label>
          <label className="field">机房
            <select value={elevator.machineRoom} onChange={(event) => patch({ machineRoom: event.target.value as Project["elevator"]["machineRoom"] })}>
              <option value="">未填</option>
              <option value="above">住宅上方</option>
              <option value="beside">旁边</option>
              <option value="other">其他</option>
              <option value="none">没有</option>
              <option value="unknown">不清楚</option>
            </select>
          </label>
          <label className="field">听到的声音<textarea value={elevator.noiseNote} onChange={(event) => patch({ noiseNote: event.target.value })} /></label>
          <label className="field">感到的振动<textarea value={elevator.vibrationNote} onChange={(event) => patch({ vibrationNote: event.target.value })} /></label>
          <p className="small">若没注意过，请写「未观察」。留空会被当成缺少记录，而不是安静。</p>
        </>
      ) : (
        <p>已选择不靠近电梯。报告里电梯规则标为不适用，也不需要在套外绘制。</p>
      )}
    </section>
  );
}
