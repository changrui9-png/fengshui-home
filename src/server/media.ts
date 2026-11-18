export const MAX_FRAMES = 4;
export const MAX_FRAME_BYTES = 1_200_000;

export function sniffImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function decodeFrame(dataBase64: string, declaredMime: string): { ok: true; bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp" } | { ok: false; error: string } {
  if (!/^image\/(jpeg|png|webp)$/.test(declaredMime)) return { ok: false, error: "只接受 JPEG、PNG 或 WEBP 关键帧。" };
  if (!/^[A-Za-z0-9+/=\s]+$/.test(dataBase64) || dataBase64.length > MAX_FRAME_BYTES * 2) {
    return { ok: false, error: "关键帧数据无效或过大。" };
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(dataBase64, "base64"));
  } catch {
    return { ok: false, error: "关键帧不是合法的 base64。" };
  }
  if (bytes.length === 0 || bytes.length > MAX_FRAME_BYTES) return { ok: false, error: "关键帧超过大小限制。" };
  const sniffed = sniffImage(bytes);
  if (!sniffed) return { ok: false, error: "文件头与图片类型不符，已拒绝。" };
  if (sniffed !== declaredMime && !(sniffed === "image/jpeg" && declaredMime === "image/jpeg")) {
    return { ok: false, error: "声明的类型和文件头不一致。" };
  }
  return { ok: true, bytes, mime: sniffed };
}
