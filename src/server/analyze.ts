import { acceptHypotheses, type AcceptedHypothesis } from "./hypotheses";
import { decodeFrame, MAX_FRAMES } from "./media";
import { analysisPrompt, endpointFor, extractJsonObject, readAiEnv, type AiConfig } from "./provider";

export interface AnalyzeRequest {
  consent?: unknown;
  transcript?: unknown;
  notes?: unknown;
  frames?: unknown;
}

export interface AnalyzeResult {
  status: number;
  body: Record<string, unknown>;
}

const hits = new Map<string, number[]>();

export function resetRateLimit(): void {
  hits.clear();
}

export function allowRequest(ip: string, maxPerHour: number, now = Date.now()): boolean {
  const windowStart = now - 60 * 60 * 1000;
  const recent = (hits.get(ip) ?? []).filter((time) => time > windowStart);
  if (recent.length >= maxPerHour) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

export async function handleAnalyze(
  input: AnalyzeRequest,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  ip = "local",
): Promise<AnalyzeResult> {
  if (input.consent !== true) {
    return { status: 400, body: { analyzed: false, error: "consent-required", message: "发送画面前需要明确同意。" } };
  }
  const transcript = typeof input.transcript === "string" ? input.transcript.slice(0, 8000) : "";
  const notes = typeof input.notes === "string" ? input.notes.slice(0, 4000) : "";
  const frames = Array.isArray(input.frames) ? input.frames.slice(0, MAX_FRAMES) : [];
  if (Array.isArray(input.frames) && input.frames.length > MAX_FRAMES) {
    return { status: 400, body: { analyzed: false, error: "too-many-frames", message: "关键帧过多。" } };
  }

  const decoded: { mime: string; dataBase64: string }[] = [];
  for (const frame of frames) {
    if (typeof frame !== "object" || frame === null) {
      return { status: 400, body: { analyzed: false, error: "bad-frame", message: "关键帧格式不正确。" } };
    }
    const row = frame as { mime?: unknown; dataBase64?: unknown };
    if (typeof row.dataBase64 !== "string" || typeof row.mime !== "string") {
      return { status: 400, body: { analyzed: false, error: "bad-frame", message: "关键帧格式不正确。" } };
    }
    const checked = decodeFrame(row.dataBase64, row.mime);
    if (!checked.ok) return { status: 400, body: { analyzed: false, error: "bad-frame", message: checked.error } };
    decoded.push({ mime: checked.mime, dataBase64: row.dataBase64.replace(/\s/g, "") });
  }

  const config = readAiEnv(env);
  if (!config.configured) {
    return {
      status: 503,
      body: {
        analyzed: false,
        error: "unconfigured",
        reason: config.reason,
        message: "服务器没有可用的视觉模型配置。画面没有发送，视频没有被分析。",
      },
    };
  }

  if (!allowRequest(ip, config.ai.maxPerHour)) {
    return { status: 429, body: { analyzed: false, error: "rate-limit", message: "这一小时的模型请求已达上限。" } };
  }

  const endpoint = endpointFor(config.ai);
  if ("error" in endpoint) {
    return { status: 503, body: { analyzed: false, error: "unconfigured", message: "模型地址不在允许名单内，没有发送。" } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const response = await fetchImpl(endpoint.url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: providerHeaders(config.ai),
      body: JSON.stringify(providerBody(config.ai, transcript, notes, decoded)),
    });
    if (!response.ok) {
      return { status: 502, body: { analyzed: false, error: "provider", message: "模型服务没有成功返回，本次没有分析结果。" } };
    }
    const payload = (await response.json()) as unknown;
    const text = providerText(config.ai.provider, payload);
    const parsed = extractJsonObject(text);
    const { accepted, dropped } = acceptHypotheses(transcript, notes, parsed, decoded.length > 0);
    return {
      status: 200,
      body: {
        analyzed: true,
        provider: config.ai.provider,
        destinationHost: endpoint.host,
        accepted,
        dropped,
        message: "以下内容是待确认假设，不是测量，也不是最终平面。",
      },
    };
  } catch {
    return { status: 502, body: { analyzed: false, error: "provider", message: "模型请求失败或超时。没有把失败说成已分析。" } };
  } finally {
    clearTimeout(timer);
  }
}

function providerHeaders(ai: AiConfig): Record<string, string> {
  if (ai.provider === "gemini") return { "content-type": "application/json", "x-goog-api-key": ai.apiKey };
  return { "content-type": "application/json", authorization: `Bearer ${ai.apiKey}` };
}

function providerBody(ai: AiConfig, transcript: string, notes: string, frames: { mime: string; dataBase64: string }[]): unknown {
  const userText = `旁白：\n${transcript || "（无）"}\n备注：\n${notes || "（无）"}`;
  if (ai.provider === "gemini") {
    return {
      contents: [
        {
          role: "user",
          parts: [
            { text: analysisPrompt() + "\n" + userText },
            ...frames.map((frame) => ({ inline_data: { mime_type: frame.mime, data: frame.dataBase64 } })),
          ],
        },
      ],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    };
  }
  return {
    model: ai.model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: analysisPrompt() },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          ...frames.map((frame) => ({ type: "image_url", image_url: { url: `data:${frame.mime};base64,${frame.dataBase64}` } })),
        ],
      },
    ],
  };
}

function providerText(provider: AiConfig["provider"], payload: unknown): string {
  if (typeof payload !== "object" || payload === null) throw new Error("空响应");
  if (provider === "gemini") {
    const candidates = (payload as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates;
    const text = candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text) throw new Error("没有文本");
    return text;
  }
  const choices = (payload as { choices?: { message?: { content?: string } }[] }).choices;
  const text = choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("没有文本");
  return text;
}

export function publicHealth(env: Record<string, string | undefined>): Record<string, unknown> {
  const config = readAiEnv(env);
  if (!config.configured) {
    return { aiConfigured: false, provider: null, destinationHost: null, reason: config.reason };
  }
  const endpoint = endpointFor(config.ai);
  return {
    aiConfigured: true,
    provider: config.ai.provider,
    destinationHost: "host" in endpoint ? endpoint.host : null,
    reason: null,
  };
}

export type { AcceptedHypothesis };
