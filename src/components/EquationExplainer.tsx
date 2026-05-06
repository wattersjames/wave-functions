"use client";

import { useEffect, useRef, useState } from "react";
import type { WavePreset } from "@/lib/wavePhysics";
import { INITIAL_USER_FACING_PROMPT } from "@/lib/explainPrompts";

type ChatTurn = { role: "user" | "assistant"; content: string };

export function EquationExplainer({ preset }: { preset: WavePreset }) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setFollowUp("");
    setError(null);
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, [preset.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft, loading]);

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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          AI tutor (Vercel AI Gateway)
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExplainInitial}
            disabled={loading}
            className="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Explain to me
          </button>
          {loading ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Stop
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        Uses model <code className="font-mono text-[0.7rem]">openai/gpt-5.4</code> through the
        gateway. On Vercel, enable AI Gateway for the project; locally run{" "}
        <code className="font-mono text-[0.7rem]">vercel env pull</code> or set{" "}
        <code className="font-mono text-[0.7rem]">AI_GATEWAY_API_KEY</code>.
      </p>

      <div className="max-h-80 min-h-[7rem] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white/80 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/60">
        {messages.length === 0 && !draft ? (
          <p className="text-zinc-500 dark:text-zinc-500">
            Press <span className="font-medium text-zinc-700 dark:text-zinc-300">Explain to me</span>{" "}
            for a tailored walkthrough of this preset.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={
              m.role === "user"
                ? "ml-4 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                : "mr-4 rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-2 text-zinc-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-zinc-100"
            }
          >
            <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-400">
              {m.role === "user" ? "You" : "Tutor"}
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
        {draft ? (
          <div className="mr-4 rounded-lg border border-dashed border-violet-300 bg-violet-50/50 px-3 py-2 text-zinc-800 dark:border-violet-800 dark:bg-violet-950/20 dark:text-zinc-100">
            <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
              Tutor
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{draft}</div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Follow-up question
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
            placeholder="Why does |ψ|² move for the superposition but not for n = 1? (Shift+Enter for newline)"
            className="resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-violet-500/30 focus-visible:ring-2 dark:border-zinc-600 dark:bg-zinc-900"
            disabled={loading}
          />
        </label>
        <button
          type="button"
          onClick={handleFollowUp}
          disabled={loading || !followUp.trim()}
          className="h-10 shrink-0 rounded-full border border-zinc-300 px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Send
        </button>
      </div>
    </div>
  );
}
