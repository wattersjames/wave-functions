import { streamText, type ModelMessage } from "ai";
import {
  WAVE_EXPLAIN_SYSTEM,
  buildInitialExplainerUserContent,
} from "@/lib/explainPrompts";
import {
  PRESETS,
  findPreset,
  type WavePresetId,
} from "@/lib/wavePhysics";

export const maxDuration = 60;

const MODEL = "openai/gpt-5.4";

type ChatBody = {
  presetId?: string;
  initial?: boolean;
  messages?: { role: string; content: string }[];
};

const VALID_PRESET_IDS = new Set<string>(PRESETS.map((p) => p.id));

function isWavePresetId(id: string): id is WavePresetId {
  return VALID_PRESET_IDS.has(id);
}

function toModelMessages(
  raw: { role: string; content: string }[] | undefined,
): ModelMessage[] | null {
  if (!raw?.length) return null;
  const out: ModelMessage[] = [];
  for (const m of raw) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const c = typeof m.content === "string" ? m.content : "";
    if (c.length > 16_000) return null;
    out.push({ role: m.role, content: c });
  }
  return out.length ? out : null;
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const presetIdRaw = body.presetId;
  if (!presetIdRaw || !isWavePresetId(presetIdRaw)) {
    return new Response(JSON.stringify({ error: "Unknown or missing presetId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const preset = findPreset(presetIdRaw);
  let messages: ModelMessage[];

  if (body.initial === true) {
    messages = [
      {
        role: "user",
        content: buildInitialExplainerUserContent(preset),
      },
    ];
  } else {
    const parsed = toModelMessages(body.messages);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Provide initial: true or a non-empty messages array" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    messages = parsed;
  }

  const result = streamText({
    model: MODEL,
    system: WAVE_EXPLAIN_SYSTEM,
    messages,
    providerOptions: {
      gateway: {
        tags: ["wave-functions:explain", `preset:${preset.id}`],
      },
    },
  });

  return result.toTextStreamResponse();
}
