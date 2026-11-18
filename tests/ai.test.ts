import { afterEach, describe, expect, it } from "vitest";
import { handleAnalyze, resetRateLimit } from "../src/server/analyze";
import { acceptHypotheses } from "../src/server/hypotheses";
import { sniffImage } from "../src/server/media";
import { readAiEnv } from "../src/server/provider";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]).toString("base64");

afterEach(() => resetRateLimit());

describe("模型适配", () => {
  it("没有密钥时明确返回未分析", async () => {
    const result = await handleAnalyze(
      { consent: true, transcript: "主卧朝南", frames: [{ mime: "image/jpeg", dataBase64: jpeg }] },
      {},
      fetch,
    );
    expect(result.status).toBe(503);
    expect(result.body.analyzed).toBe(false);
    expect(result.body.error).toBe("unconfigured");
    expect(String(result.body.message)).toContain("没有被分析");
  });

  it("拒绝没有同意、错误的文件头，以及允许名单外的地址", async () => {
    const denied = await handleAnalyze({ consent: false, transcript: "主卧朝南" }, {}, fetch);
    expect(denied.status).toBe(400);
    expect(sniffImage(Uint8Array.from([0x47, 0x49, 0x46]))).toBeNull();
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38]).toString("base64");
    const env = { AI_PROVIDER: "openai", AI_API_KEY: "secret", AI_MODEL: "gpt-4o-mini" };
    const bad = await handleAnalyze({ consent: true, frames: [{ mime: "image/jpeg", dataBase64: gif }] }, env, fetch);
    expect(bad.status).toBe(400);
    expect(bad.body.analyzed).toBe(false);
    expect(readAiEnv({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k", AI_MODEL: "m", AI_BASE_URL: "http://169.254.169.254/chat/completions", AI_ALLOWED_HOSTS: "api.openai.com" }).configured).toBe(false);
    expect(readAiEnv({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k", AI_MODEL: "m", AI_BASE_URL: "https://evil.example/chat/completions", AI_ALLOWED_HOSTS: "api.openai.com" }).configured).toBe(false);
  });

  it("丢掉旁白里没有的房间，并且不跟随重定向", async () => {
    resetRateLimit();
    const env = { AI_PROVIDER: "openai", AI_API_KEY: "secret", AI_MODEL: "gpt-4o-mini", AI_MAX_REQUESTS_PER_HOUR: "2" };
    let seenRedirect = "";
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      seenRedirect = String(init?.redirect);
      const content = JSON.stringify({
        rooms: [
          { name: "书房", evidenceQuote: "凭空出现的书房" },
          { name: "主卧", evidenceQuote: "主卧朝南", azimuthDeg: 180, widthM: 4 },
        ],
        relations: [],
        furnishings: [],
        elevator: { near: "yes", evidenceQuote: "模型自己说有电梯" },
        uncertainties: ["看不出尺寸"],
      });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    }) as typeof fetch;
    const result = await handleAnalyze({ consent: true, transcript: "主卧朝南。", notes: "" }, env, fetchImpl, "tester");
    expect(seenRedirect).toBe("error");
    expect(result.body.analyzed).toBe(true);
    const accepted = result.body.accepted as { rooms: { name: string }[]; elevatorNear: string | null };
    expect(accepted.rooms.map((room) => room.name)).toEqual(["主卧"]);
    expect(accepted.elevatorNear).toBeNull();
    expect(JSON.stringify(result.body.dropped)).toContain("书房");
    expect(JSON.stringify(result.body)).not.toContain("secret");

    const limited = await handleAnalyze({ consent: true, transcript: "主卧朝南" }, { ...env, AI_MAX_REQUESTS_PER_HOUR: "1" }, fetchImpl, "tester");
    expect(limited.status).toBe(429);
    expect(limited.body.analyzed).toBe(false);
  });

  it("假设筛选本身也不接受无依据的家具", () => {
    const { accepted, dropped } = acceptHypotheses("客厅有沙发", "", { furnishings: [{ roomName: "客厅", kind: "bed", evidenceQuote: "其实是床" }] }, false);
    expect(accepted.furnishings).toHaveLength(0);
    expect(dropped.join("")).toContain("bed");
  });
});
