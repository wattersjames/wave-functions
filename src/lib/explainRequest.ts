import type { ModelMessage } from "ai";

export const MAX_BODY_BYTES = 128_000;
export const MAX_MESSAGES = 24;
export const MAX_MESSAGE_CHARS = 8_000;
export const MAX_TOTAL_MESSAGE_CHARS = 32_000;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 20;

type RateBucket = { count: number; resetAt: number };

type ChatMessage = { role: string; content: string };

export type ChatBody = {
  presetId?: string;
  initial?: boolean;
  messages?: ChatMessage[];
};

export function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

export function getClientKey(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "anonymous";
}

export function isRateLimited(
  buckets: Map<string, RateBucket>,
  key: string,
  now = Date.now(),
): boolean {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function readJsonBody(req: Request): Promise<ChatBody | Response> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonError("Expected application/json request body", 415);
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return jsonError("Request body is too large", 413);
  }

  try {
    return JSON.parse(raw) as ChatBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
}

export function toModelMessages(raw: ChatMessage[] | undefined): ModelMessage[] | null {
  if (!raw?.length || raw.length > MAX_MESSAGES) return null;

  const out: ModelMessage[] = [];
  let totalChars = 0;

  for (const m of raw) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const c = typeof m.content === "string" ? m.content.trim() : "";
    if (!c || c.length > MAX_MESSAGE_CHARS) return null;
    totalChars += c.length;
    if (totalChars > MAX_TOTAL_MESSAGE_CHARS) return null;
    out.push({ role: m.role, content: c });
  }

  return out.length ? out : null;
}
