import { useEffect, useState } from "react";
import { exampleProject } from "../domain/example";
import { exportProject } from "../domain/importExport";
import type { Project } from "../domain/types";
import { createProject } from "../domain/project";
import { ElevatorPanel, QuestionsPanel, ReportPanel } from "./ReportPanel";
import { MaterialsPanel } from "./MaterialsPanel";
import { PlanEditor } from "./PlanEditor";
import { downloadText, renderPlanSvg, svgToPng } from "./planSvg";

type Step = "materials" | "clarify" | "plan" | "elevator" | "report" | "export";

const STEPS: { id: Step; label: string }[] = [
  { id: "materials", label: "材料" },
  { id: "clarify", label: "澄清" },
  { id: "plan", label: "户型" },
  { id: "elevator", label: "电梯" },
  { id: "report", label: "评估" },
  { id: "export", label: "导出" },
];

interface Health {
  aiConfigured: boolean;
  provider: string | null;
  destinationHost: string | null;
  reason: string | null;
}

export function App() {
  const [project, setProject] = useState<Project>(() => createProject());
  const [step, setStep] = useState<Step>("materials");
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [finalized, setFinalized] = useState(false);

  useEffect(() => {
    void fetch("./api/health")
      .then((response) => response.json())
      .then((body: Health) => setHealth(body))
      .catch(() => setHealth({ aiConfigured: false, provider: null, destinationHost: null, reason: "not-set" }));
  }, []);

  function update(next: Project) {
    setFinalized(false);
    setProject(next);
  }

  return (
    <>
      <a className="skip" href="#main">跳到内容</a>
      <div className="shell">
        <header className="top">
          <div>
            <h1>家宅笔记</h1>
            <p>把叙述、草图和你确认过的平面整理成可编辑的示意图，再分开写下传统风水文化解读和居住环境观察。</p>
          </div>
        </header>
        {project.example ? <p className="banner" role="status">示例数据，不是真实住宅。其中的方位、家具和电梯都是虚构的。</p> : null}
        {message ? <p className="banner" role="status">{message}</p> : null}
        <nav className="steps no-print" aria-label="步骤">
          {STEPS.map((item) => (
            <button key={item.id} type="button" aria-current={step === item.id ? "step" : undefined} onClick={() => setStep(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <main id="main">
          {step === "materials" ? <MaterialsPanel project={project} setProject={update} health={health} onMessage={setMessage} /> : null}
          {step === "clarify" ? <QuestionsPanel project={project} /> : null}
          {step === "plan" ? <PlanEditor project={project} setProject={update} /> : null}
          {step === "elevator" ? <ElevatorPanel project={project} setProject={update} /> : null}
          {step === "report" ? <ReportPanel project={project} finalized={finalized} onFinalize={() => setFinalized(true)} /> : null}
          {step === "export" ? <ExportPanel project={project} /> : null}
        </main>
      </div>
    </>
  );
}

function ExportPanel({ project }: { project: Project }) {
  const svg = renderPlanSvg(project);
  return (
    <section className="card">
      <h2>导出</h2>
      <p>JSON 可以再次导入。SVG 和 PNG 是当前这张示意图。打印时用浏览器的「另存为 PDF」，其中会包含评估页里已经写明的证据和来源。</p>
      <div className="grid-actions">
        <button type="button" onClick={() => void downloadText("fengshui-home.json", exportProject(project), "application/json")}>下载 JSON</button>
        <button type="button" onClick={() => void downloadText("floorplan.svg", svg, "image/svg+xml")}>下载 SVG</button>
        <button
          type="button"
          onClick={() => {
            void svgToPng(svg).then((blob) => {
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "floorplan.png";
              link.click();
              URL.revokeObjectURL(url);
            });
          }}
        >
          下载 PNG
        </button>
        <button type="button" onClick={() => window.print()}>打印或保存 PDF</button>
        <button type="button" onClick={() => void downloadText("example.json", exportProject(exampleProject()), "application/json")}>下载示例 JSON</button>
      </div>
      <div className="plan-wrap" dangerouslySetInnerHTML={{ __html: svg }} />
    </section>
  );
}
