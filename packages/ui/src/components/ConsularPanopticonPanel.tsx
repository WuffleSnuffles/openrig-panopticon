import React, { useState } from "react";

export interface ConsularDialogueItem {
  id: string;
  sender: "Consul Nia Nova" | "Consul Ferric Lunaux" | "Overseer";
  content: string;
  thinking?: string;
  replyTo?: { id: string; sender: string; content: string };
  timestamp: string;
}

export interface ConsularPanopticonPanelProps {
  initialDialogue?: ConsularDialogueItem[];
  niaStatus?: "checking_workers" | "working" | "debating" | "idle";
  ferricStatus?: "verifying" | "working" | "debating" | "idle";
  onSendDirective?: (prompt: string) => void | Promise<void>;
}

export function ConsularPanopticonPanel({
  initialDialogue = [],
  niaStatus = "checking_workers",
  ferricStatus = "verifying",
  onSendDirective,
}: ConsularPanopticonPanelProps) {
  const [dialogue, setDialogue] = useState<ConsularDialogueItem[]>(initialDialogue);
  const [input, setInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    const userMsg: ConsularDialogueItem = {
      id: `msg-${Date.now()}`,
      sender: "Overseer",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setDialogue((prev) => [...prev, userMsg]);
    await onSendDirective?.(trimmed);
  };

  return (
    <section
      className="flex flex-col gap-3 rounded border border-zinc-800 bg-zinc-950 p-4 text-zinc-100"
      data-testid="consular-panopticon-panel"
    >
      <header className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2" data-testid="consul-nia-header">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="font-semibold tracking-wide text-amber-400">Consul Nia Nova</span>
          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300" data-testid="nia-activity-badge">
            {niaStatus}
          </span>
        </div>
        <div className="text-xs font-mono uppercase tracking-widest text-zinc-400">
          Roman Dual-Consul Governance · 2/2 Gate Consensus
        </div>
        <div className="flex items-center gap-2" data-testid="consul-ferric-header">
          <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300" data-testid="ferric-activity-badge">
            {ferricStatus}
          </span>
          <span className="font-semibold tracking-wide text-sky-400">Consul Ferric Lunaux</span>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
        </div>
      </header>

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto py-2" data-testid="consular-dialogue-feed">
        {dialogue.map((item) => (
          <article key={item.id} className="rounded border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-base">
            {item.replyTo && (
              <div className="mb-1 border-l-2 border-zinc-600 pl-2 text-xs text-zinc-400">
                Replying to {item.replyTo.sender}: {item.replyTo.content}
              </div>
            )}
            {item.thinking && (
              <div className="mb-1.5 line-clamp-2 text-xs italic text-zinc-400" data-testid="inline-deliberation-summary">
                {item.thinking}
              </div>
            )}
            <div className="font-medium text-zinc-200">
              <span className="mr-2 font-bold text-amber-300">{item.sender}:</span>
              <span>{item.content}</span>
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
        <button
          type="button"
          aria-label="Add attachment"
          className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm font-bold text-zinc-200"
          data-testid="single-plus-attachment-btn"
        >
          +
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Direct Consuls Nia Nova & Ferric Lunaux..."
          className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
          data-testid="overseer-prompt-input"
        />
        <button
          type="submit"
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-zinc-950"
          data-testid="overseer-send-btn"
        >
          Transmit
        </button>
      </form>
    </section>
  );
}
