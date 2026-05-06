"use client";

import { useEffect, useRef, useState } from "react";
import type { WavePreset } from "@/lib/wavePhysics";
import { INITIAL_USER_FACING_PROMPT } from "@/lib/explainPrompts";
import { MarkdownTutor } from "./MarkdownTutor";

type ChatTurn = { role: "user" | "assistant"; content: string };

type Props = {
  preset: WavePreset;
  /**
   * Monotonic counter; whenever it increases, the dock opens (if closed)
   * and runs the initial "Explain to me" flow.
   */
  explainSignal: number;
};

const MIN_W = 320;
const MIN_H = 320;
const DEFAULT_W = 420;
const DEFAULT_H = 540;

export function EquationExplainer({ preset, explainSignal }: Props) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSignalRef = useRef(0);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft, loading, open]);

  async function streamFromApi(
    body: Record<string, unknown>,
    onDelta: (chunk: string) => void,
  ): Promise<void> {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error) detail = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail || `Request failed (${res.status})`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const dec = new TextDecoder();
    let acc = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += dec.decode(value, { stream: true });
      onDelta(acc);
    }
  }

  async function handleExplainInitial() {
    if (loading) return;
    setError(null);

    const userLine = INITIAL_USER_FACING_PROMPT(preset.label);
    setMessages((m) => [...m, { role: "user", content: userLine }]);
    setDraft("");
    setLoading(true);

    try {
      let buffer = "";
      await streamFromApi({ presetId: preset.id, initial: true }, (acc) => {
        buffer = acc;
        setDraft(acc);
      });
      setMessages((m) => [...m, { role: "assistant", content: buffer }]);
      setDraft("");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function handleFollowUp() {
    const text = followUp.trim();
    if (!text || loading) return;

    const nextMessages: ChatTurn[] = [
      ...messages,
      { role: "user" as const, content: text },
    ];
    setMessages(nextMessages);
    setFollowUp("");
    setDraft("");
    setLoading(true);
    setError(null);

    try {
      let buffer = "";
      await streamFromApi(
        {
          presetId: preset.id,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        },
        (acc) => {
          buffer = acc;
          setDraft(acc);
        },
      );
      setMessages((m) => [...m, { role: "assistant", content: buffer }]);
      setDraft("");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  useEffect(() => {
    if (explainSignal === lastSignalRef.current) return;
    lastSignalRef.current = explainSignal;
    if (explainSignal === 0) return;

    const id = window.setTimeout(() => {
      setOpen(true);
      void handleExplainInitial();
    }, 0);

    return () => window.clearTimeout(id);
    // We intentionally only react to explainSignal changes; preset is read live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explainSignal]);

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;
    const onMove = (ev: PointerEvent) => {
      const dx = startX - ev.clientX;
      const dy = startY - ev.clientY;
      const maxW = Math.max(MIN_W, window.innerWidth - 32);
      const maxH = Math.max(MIN_H, window.innerHeight - 96);
      setSize({
        w: Math.max(MIN_W, Math.min(maxW, startW + dx)),
        h: Math.max(MIN_H, Math.min(maxH, startH + dy)),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-violet-900/20 transition hover:bg-violet-500"
        aria-label={open ? "Hide AI tutor" : "Open AI tutor"}
      >
        <span aria-hidden className="text-base leading-none">
          {open ? "⌄" : "ψ"}
        </span>
        {open ? "Hide tutor" : "AI tutor"}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="AI tutor chat"
          className="fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/20 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/50"
          style={{
            width: size.w,
            height: size.h,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "calc(100vh - 96px)",
          }}
        >
          <div
            onPointerDown={startResize}
            className="absolute left-0 top-0 z-20 h-5 w-5 cursor-nwse-resize"
            title="Drag to resize"
            aria-hidden
          >
            <div className="pointer-events-none absolute left-1 top-1 h-3 w-3 rounded-tl-md border-l-2 border-t-2 border-violet-400/80 dark:border-violet-500/80" />
          </div>

          <header className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-violet-50/60 px-4 py-2 pl-7 dark:border-zinc-800 dark:bg-violet-950/30">
            <div className="flex min-w-0 flex-col">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                AI Tutor · GPT-5.4
              </span>
              <span
                className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100"
                title={preset.label}
              >
                {preset.label}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleExplainInitial}
                disabled={loading}
                className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Explain
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Close tutor"
              >
                <span aria-hidden>✕</span>
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {messages.length === 0 && !draft && !loading ? (
              <p className="text-zinc-500 dark:text-zinc-500">
                Click{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  Explain
                </span>{" "}
                for a walkthrough of the current preset, or ask a question below.
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={
                  m.role === "user"
                    ? "ml-6 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                    : "mr-6 rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2 dark:border-violet-900/40 dark:bg-violet-950/30"
                }
              >
                <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-400">
                  {m.role === "user" ? "You" : "Tutor"}
                </div>
                {m.role === "assistant" ? (
                  <MarkdownTutor>{m.content}</MarkdownTutor>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </div>
                )}
              </div>
            ))}
            {draft ? (
              <div className="mr-6 rounded-lg border border-dashed border-violet-300 bg-violet-50/50 px-3 py-2 dark:border-violet-800 dark:bg-violet-950/20">
                <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  Tutor
                </div>
                <MarkdownTutor>{draft}</MarkdownTutor>
              </div>
            ) : null}
            {loading && !draft ? (
              <div className="mr-6 rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-zinc-500 dark:border-violet-900/40 dark:bg-violet-950/20">
                <span className="inline-flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                  </span>
                  Thinking…
                </span>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          {error ? (
            <div
              className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <footer className="border-t border-zinc-200 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-end gap-2">
              <textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFollowUp();
                  }
                }}
                rows={2}
                placeholder="Ask a follow-up… (Shift+Enter for newline)"
                className="min-w-0 flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-violet-500/30 focus-visible:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                disabled={loading}
              />
              {loading ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="h-9 shrink-0 rounded-full border border-zinc-300 px-3 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFollowUp}
                  disabled={!followUp.trim()}
                  className="h-9 shrink-0 rounded-full bg-zinc-900 px-4 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Send
                </button>
              )}
            </div>
          </footer>
        </div>
      ) : null}
    </>
  );
}
