import { streamText, type ModelMessage } from "ai";
import {
  WAVE_EXPLAIN_SYSTEM,
  buildInitialExplainerUserContent,
} from "@/lib/explainPrompts";
import { PRESETS, findPreset, type WavePresetId } from "@/lib/wavePhysics";
import {
  getClientKey,
  isRateLimited,
  jsonError,
  readJsonBody,
  toModelMessages,
} from "@/lib/explainRequest";

export const maxDuration = 60;

export const DEFAULT_MODEL = "openai/gpt-5.4";
const MODEL = process.env.AI_EXPLAIN_MODEL ?? DEFAULT_MODEL;

const VALID_PRESET_IDS = new Set<string>(PRESETS.map((p) => p.id));
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function isWavePresetId(id: string): id is WavePresetId {
  return VALID_PRESET_IDS.has(id);
}

export async function POST(req: Request) {
  if (isRateLimited(requestBuckets, getClientKey(req))) {
    return jsonError("Too many tutor requests. Please wait a minute and try again.", 429);
  }

  const parsedBody = await readJsonBody(req);
  if (parsedBody instanceof Response) return parsedBody;
  const body = parsedBody;

  const presetIdRaw = body.presetId;
  if (!presetIdRaw || !isWavePresetId(presetIdRaw)) {
    return jsonError("Unknown or missing presetId", 400);
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
      return jsonError("Provide initial: true or a valid non-empty messages array", 400);
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
    onError: ({ error }) => {
      console.error("[/api/explain] streamText error:", error);
    },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const part of result.fullStream) {
          if (part.type === "text-delta") {
            controller.enqueue(encoder.encode(part.text));
          } else if (part.type === "error") {
            console.error("[/api/explain] gateway error part:", part.error);
            controller.enqueue(
              encoder.encode(
                "\n\n⚠️ The tutor hit a provider error. Please retry in a moment.",
              ),
            );
          }
        }
      } catch (err) {
        console.error("[/api/explain] stream exception:", err);
        controller.enqueue(
          encoder.encode(
            "\n\n⚠️ The tutor stream ended unexpectedly. Please retry in a moment.",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
