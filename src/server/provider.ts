export interface AiConfig {
  provider: "openai" | "gemini" | "openai-compatible";
  apiKey: string;
  model: string;
  baseUrl: string;
  allowedHosts: string[];
  timeoutMs: number;
  maxPerHour: number;
}

export type EnvRead =
  | { configured: false; reason: "not-set" | "missing-key" | "bad-model" | "bad-host" | "bad-provider" }
  | { configured: true; ai: AiConfig };

const MODEL_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

export function readAiEnv(env: Record<string, string | undefined>): EnvRead {
  const provider = (env.AI_PROVIDER ?? "").trim();
  if (!provider) return { configured: false, reason: "not-set" };
  if (provider !== "openai" && provider !== "gemini" && provider !== "openai-compatible") {
    return { configured: false, reason: "bad-provider" };
  }
  const apiKey = (env.AI_API_KEY ?? "").trim();
  if (!apiKey) return { configured: false, reason: "missing-key" };
  const model = (env.AI_MODEL ?? "").trim();
  if (!MODEL_RE.test(model)) return { configured: false, reason: "bad-model" };
  const allowedHosts = (env.AI_ALLOWED_HOSTS ?? "api.openai.com,generativelanguage.googleapis.com")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const baseUrl = (env.AI_BASE_URL ?? "").trim();
  const timeoutMs = Number(env.AI_TIMEOUT_MS ?? 45000);
  const maxPerHour = Number(env.AI_MAX_REQUESTS_PER_HOUR ?? 6);
  const ai: AiConfig = {
    provider,
    apiKey,
    model,
    baseUrl,
    allowedHosts,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 45000,
    maxPerHour: Number.isFinite(maxPerHour) ? maxPerHour : 6,
  };
  const endpoint = endpointFor(ai);
  if ("error" in endpoint) return { configured: false, reason: "bad-host" };
  return { configured: true, ai };
}

export function endpointFor(ai: AiConfig): { url: string; host: string } | { error: string } {
  let url: URL;
  if (ai.provider === "openai") {
    url = new URL("https://api.openai.com/v1/chat/completions");
  } else if (ai.provider === "gemini") {
    url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${ai.model}:generateContent`);
  } else {
    if (!ai.baseUrl) return { error: "缺少 AI_BASE_URL。" };
    try {
      url = new URL(ai.baseUrl);
    } catch {
      return { error: "AI_BASE_URL 无法解析。" };
    }
    if (url.protocol !== "https:" || url.username || url.password) return { error: "兼容接口必须是不带账号的 https。" };
    if (!url.pathname.endsWith("/chat/completions")) return { error: "兼容接口路径必须以 /chat/completions 结尾。" };
  }
  if (url.protocol !== "https:") return { error: "只允许 https。" };
  if (!ai.allowedHosts.includes(url.host.toLowerCase())) return { error: "主机不在允许名单。" };
  return { url: url.toString(), host: url.host };
}

export function analysisPrompt(): string {
  return [
    "你帮助整理住宅材料。只输出 JSON 对象，不要写 Markdown。",
    "禁止编造旁白或画面里没有的房间、门窗、家具、尺寸、方位和电梯。",
    "每个房间、相邻关系和家具都必须带 evidenceQuote。",
    "evidenceQuote 必须是旁白或备注中的连续原文；只有画面里看得见、文字没写时，才用「画面」开头。",
    "不要输出坐标、米数或面积。一个房间的朝向不能推断其他房间。",
    "方位不清楚时 azimuthDeg 用 null。电梯没提到时 elevator.near 用 unknown，且 evidenceQuote 为空则不要下结论。",
    "字段：rooms[{name,evidenceQuote,azimuthDeg}], relations[{fromName,toName,evidenceQuote}], furnishings[{roomName,kind,evidenceQuote}], elevator{near,evidenceQuote}, uncertainties[string], questions[string]。",
    "kind 只能是 bed, sofa, desk, dining-table, stove, sink, mirror, toilet, wardrobe, tv。",
  ].join("");
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回 JSON 对象。");
  return JSON.parse(body.slice(start, end + 1));
}
