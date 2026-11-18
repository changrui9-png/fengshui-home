import { useRef, useState } from "react";
import { applyNarration } from "../domain/project";
import { importVideoTo3dScene } from "../domain/videoTo3d";
import { parseProjectJson } from "../domain/importExport";
import { exampleProject, incompleteExample } from "../domain/example";
import { createProject } from "../domain/project";
import type { Project } from "../domain/types";
import { applyHypotheses, type AcceptedHypothesis } from "../server/hypotheses";

interface Health {
  aiConfigured: boolean;
  provider: string | null;
  destinationHost: string | null;
  reason: string | null;
}

export function MaterialsPanel({
  project,
  setProject,
  health,
  onMessage,
}: {
  project: Project;
  setProject: (project: Project) => void;
  health: Health | null;
  onMessage: (message: string) => void;
}) {
  const [transcript, setTranscript] = useState(project.notes);
  const [consent, setConsent] = useState(false);
  const [frames, setFrames] = useState<{ url: string; dataBase64: string; mime: string }[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const underlay = useRef<string | null>(null);
  const configured = health?.aiConfigured === true;

  function clearMedia() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    for (const frame of frames) URL.revokeObjectURL(frame.url);
    if (underlay.current) URL.revokeObjectURL(underlay.current);
    underlay.current = null;
    setVideoUrl(null);
    setFrames([]);
    setConsent(false);
    setProject({ ...project, underlayNote: "", ai: { analyzed: false, provider: null, destinationHost: null, note: "已清除本机预览，没有保留上传。" } });
  }

  async function onVideo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      onMessage("请选择视频文件。文件只留在这台浏览器里。");
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      onMessage("视频超过 80MB，请剪短后再试。它没有被上传。");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setProject({ ...project, ai: { analyzed: false, provider: null, destinationHost: null, note: "已选择视频，但还没有提取关键帧，更没有分析它。" } });
  }

  async function extractFrames() {
    const video = document.querySelector("video");
    if (!video || !videoUrl) {
      onMessage("请先选择视频。");
      return;
    }
    setBusy(true);
    try {
      const shots = await grabFrames(video, 4);
      for (const frame of frames) URL.revokeObjectURL(frame.url);
      setFrames(shots);
      onMessage("关键帧只存在于这台浏览器。在你同意并成功发送之前，它们不会被解读。");
    } catch {
      onMessage("这个浏览器没能从视频里取出画面。你可以改用旁白文字或照片。");
    } finally {
      setBusy(false);
    }
  }

  async function sendFrames() {
    if (!configured) {
      onMessage("自动视频解读尚未配置。这次没有发送，也没有分析。");
      return;
    }
    if (!consent) {
      onMessage("请先阅读并勾选同意。目的地是 " + (health?.destinationHost ?? "未标明的模型服务") + "。");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("./api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          consent: true,
          transcript,
          notes: project.notes,
          frames: frames.map((frame) => ({ mime: frame.mime, dataBase64: frame.dataBase64 })),
        }),
      });
      const body = (await response.json()) as {
        analyzed?: boolean;
        message?: string;
        accepted?: AcceptedHypothesis;
        provider?: string;
        destinationHost?: string;
      };
      if (!response.ok || body.analyzed !== true || !body.accepted || !body.provider || !body.destinationHost) {
        onMessage(body.message ?? "没有得到分析结果。视频不能算作已分析。");
        return;
      }
      setProject(applyHypotheses(project, body.accepted, { provider: body.provider, destinationHost: body.destinationHost }));
      onMessage(body.message ?? "已收到待确认假设。");
    } catch {
      onMessage("请求没有完成。不要把这次操作当成视频分析。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout">
      <section className="card">
        <h2>准备材料</h2>
        <p>从入户开始连续走到每个房间，不要跳着拍。至少在一个房间里，面对窗户向外，说出房间名称，以及「向外是南」或罗盘方位角。</p>
        <p className="small">只说一个房间的方向，不能确定其他房间在哪里。需要连续走访和相邻关系，或者一张你确认过的平面。不要拍摄证件、屏幕和邻居。</p>
        <blockquote className="banner">
          示例旁白，不是你的家：从入户进来，门朝北。往南走进客厅。我站在主卧，面对东边窗户向外，方位角 90 度。电梯在入户外面东侧，机房不清楚。
        </blockquote>
        <div className="grid-actions">
          <button className="primary" type="button" onClick={() => setProject(exampleProject())}>载入完整示例</button>
          <button type="button" onClick={() => setProject(incompleteExample())}>载入信息不完整的示例</button>
          <button type="button" onClick={() => setProject(createProject())}>从空白开始</button>
        </div>
        <label className="field">
          旁白或文字说明
          <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => {
            setProject(applyNarration(project, transcript));
            onMessage("已按句式摘录文字。这不是视频分析，也没有新增房间尺寸。");
          }}
        >
          只摘录这段文字
        </button>
        <h3>视频</h3>
        <p className={configured ? "banner ok" : "banner warn"} role="status">
          {configured
            ? `视觉模型已配置，发送后才会到达 ${health?.destinationHost}。发送前仍要同意。`
            : "自动视频解读尚未配置，当前没有分析视频。可以继续使用示例、手绘、照片底图和文字。"}
        </p>
        <label className="field">
          选择视频（只留在本机）
          <input
            type="file"
            accept="video/*"
            onChange={(event) => {
              void onVideo(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {videoUrl ? <video src={videoUrl} controls style={{ width: "100%" }} /> : null}
        <div className="grid-actions">
          <button type="button" onClick={() => void extractFrames()} disabled={busy || !videoUrl}>提取关键帧</button>
          <button type="button" onClick={clearMedia}>清除视频与预览</button>
        </div>
        <div className="frames">
          {frames.map((frame) => (
            <img key={frame.url} src={frame.url} alt="本机提取的关键帧，尚未分析" />
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>我同意把上面的关键帧和文字发送到 {health?.destinationHost ?? "尚未配置的服务器模型"}。默认不保存上传，我可以随时清除。</span>
        </label>
        <button className="primary" type="button" disabled={!configured || busy} onClick={() => void sendFrames()}>
          {configured ? "发送并请求假设" : "发送不可用：尚未配置"}
        </button>
      </section>
      <aside className="card">
        <h2>导入</h2>
        <label className="field">
          项目 JSON
          <input
            data-testid="import-json"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 2_000_000) {
                onMessage("JSON 超过 2MB，已拒绝。");
                return;
              }
              void readFileText(file).then((text) => {
                const parsed = parseProjectJson(text);
                if (!parsed.ok) {
                  onMessage(parsed.errors.join(""));
                  return;
                }
                setProject(parsed.project);
                onMessage("已导入项目。导入不会把文件标记成已分析的视频。");
              });
            }}
          />
        </label>
        <label className="field">
          video-to-3d 的 scene.json
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void readFileText(file).then((text) => {
                try {
                  const parsed = importVideoTo3dScene(JSON.parse(text));
                  if (!parsed.ok) {
                    onMessage(parsed.errors.join(""));
                    return;
                  }
                  setProject(parsed.project);
                  onMessage(parsed.warnings.join(""));
                } catch {
                  onMessage("无法读取 scene.json。");
                }
              });
            }}
          />
        </label>
        <label className="field">
          户型照片或草图（只作底图，不识别）
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
                onMessage("请使用 8MB 以内的 JPEG、PNG 或 WEBP。照片不会被自动识别。");
                return;
              }
              if (underlay.current) URL.revokeObjectURL(underlay.current);
              underlay.current = URL.createObjectURL(file);
              setProject({ ...project, underlayNote: "已在本机选择一张底图。它没有被识别，也没有上传。" });
              onMessage("底图只留在本机，刷新后消失。请对照着画，不要把照片本身当成测量。");
            }}
          />
        </label>
        {project.underlayNote ? <p>{project.underlayNote}</p> : <p className="small">没有底图。</p>}
        <p className="small">video-to-3d 以 MIT 许可发布。这里只读取它的 scene.json，不包含它的重建程序。那份结果通常没有罗盘。</p>
      </aside>
    </div>
  );
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function grabFrames(video: HTMLVideoElement, count: number): Promise<{ url: string; dataBase64: string; mime: string }[]> {
  return new Promise((resolve, reject) => {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      reject(new Error("duration"));
      return;
    }
    const canvas = document.createElement("canvas");
    const width = Math.min(768, video.videoWidth || 640);
    const height = Math.round(width * ((video.videoHeight || 360) / (video.videoWidth || 640)));
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("canvas"));
      return;
    }
    const times = Array.from({ length: count }, (_, index) => (duration * (index + 1)) / (count + 1));
    const shots: { url: string; dataBase64: string; mime: string }[] = [];
    let index = 0;
    const seek = () => {
      if (index >= times.length) {
        resolve(shots);
        return;
      }
      video.currentTime = times[index];
    };
    video.onseeked = () => {
      context.drawImage(video, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("blob"));
            return;
          }
          void blob.arrayBuffer().then((buffer) => {
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (const byte of bytes) binary += String.fromCharCode(byte);
            const url = URL.createObjectURL(blob);
            shots.push({ url, dataBase64: btoa(binary), mime: "image/jpeg" });
            index += 1;
            seek();
          });
        },
        "image/jpeg",
        0.7,
      );
    };
    video.onerror = () => reject(new Error("video"));
    seek();
  });
}
