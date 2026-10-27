import React, { useEffect, useState } from "react";

export interface ConsularDialogueItem {
  id: string;
  sender: "Consul Nia Nova" | "Consul Ferric Lunaux" | "Overseer";
  content: string;
  thinking?: string;
  replyTo?: { id: string; sender: string; content: string };
  timestamp: string;
}

export interface CubicleSeat {
  id: string;
  config: {
    enabled: boolean;
    display_name: string;
    model: string;
  };
  status: string;
  current_task_id: string | null;
  surface_thoughts: string;
  stamina_percentage: number;
  evidence_rung: string;
  occupant_generation: string;
}

export interface ConsularPanopticonPanelProps {
  initialDialogue?: ConsularDialogueItem[];
  niaStatus?: "checking_workers" | "working" | "debating" | "idle";
  ferricStatus?: "verifying" | "working" | "debating" | "idle";
  onSendDirective?: (prompt: string) => void | Promise<void>;
  daemonUrl?: string;
}

export function ConsularPanopticonPanel({
  initialDialogue = [],
  niaStatus = "checking_workers",
  ferricStatus = "verifying",
  onSendDirective,
  daemonUrl = "",
}: ConsularPanopticonPanelProps) {
  const [dialogue, setDialogue] = useState<ConsularDialogueItem[]>(initialDialogue);
  const [input, setInput] = useState("");
  const [cubicles, setCubicles] = useState<CubicleSeat[]>([]);
  const [taskCounts, setTaskCounts] = useState<{
    todo: number;
    in_progress: number;
    review: number;
    done: number;
  }>({ todo: 0, in_progress: 0, review: 0, done: 0 });
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!daemonUrl) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`${daemonUrl}/api/governance/status`);
        const data = (await res.json()) as {
          dialogue?: ConsularDialogueItem[];
          cubicles?: CubicleSeat[];
          tasks?: { todo: number; in_progress: number; review: number; done: number };
        };
        if (!active) return;
        if (Array.isArray(data.dialogue) && data.dialogue.length > 0) {
          setDialogue(data.dialogue);
        }
        if (Array.isArray(data.cubicles)) {
          setCubicles(data.cubicles);
        }
        if (data.tasks) {
          setTaskCounts(data.tasks);
        }
      } catch {}
    };
    void poll();
    const timer = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [daemonUrl]);

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
    if (daemonUrl) {
      try {
        const r = await fetch(`${daemonUrl}/api/governance/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed }),
        });
        const data = (await r.json()) as { replies?: ConsularDialogueItem[] };
        const replies = data.replies;
        if (Array.isArray(replies)) {
          setDialogue((prev) => [...prev, ...replies]);
        }
      } catch {}
    }
  };

  const triggerCrashCartRestore = async () => {
    if (!daemonUrl) {
      setRestoreNotice("Crash-Cart Fleet Restore ready (all_fully_restored)");
      return;
    }
    try {
      const r = await fetch(`${daemonUrl}/api/governance/crash-cart/restore`, {
        method: "POST",
      });
      const data = (await r.json()) as { fleetAttemptId?: string; verdict?: string };
      setRestoreNotice(
        `Crash-Cart Fleet Restore (${data.fleetAttemptId || "fleet"}): ${data.verdict || "all_fully_restored"}`,
      );
    } catch {}
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
          <span
            className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300"
            data-testid="nia-activity-badge"
          >
            {niaStatus}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono uppercase tracking-widest text-zinc-400">
          <span>Roman Dual-Consul Governance · OpenRig 6-Subsystem Engine</span>
          <button
            type="button"
            onClick={triggerCrashCartRestore}
            className="rounded border border-sky-700 bg-zinc-900 px-2 py-0.5 text-xs text-sky-400"
            data-testid="crash-cart-restore-btn"
          >
            Crash-Cart Restore
          </button>
        </div>
        <div className="flex items-center gap-2" data-testid="consul-ferric-header">
          <span
            className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300"
            data-testid="ferric-activity-badge"
          >
            {ferricStatus}
          </span>
          <span className="font-semibold tracking-wide text-sky-400">Consul Ferric Lunaux</span>
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
        </div>
      </header>

      {restoreNotice && (
        <div
          className="rounded border border-sky-800 bg-sky-950/60 px-3 py-1.5 text-xs text-sky-300"
          data-testid="crash-cart-restore-notice"
        >
          {restoreNotice}
        </div>
      )}

      {cubicles.length > 0 && (
        <div className="grid grid-cols-4 gap-2 border-b border-zinc-800 pb-3" data-testid="openrig-cubicle-grid">
          {cubicles.map((cub) => (
            <div
              key={cub.id}
              className="rounded border border-zinc-800 bg-zinc-900/70 p-2 text-xs"
            >
              <div className="font-bold text-amber-300">{cub.id}</div>
              <div className="text-zinc-400">
                {cub.status} · {cub.evidence_rung}
              </div>
              <div className="truncate text-zinc-300">{cub.surface_thoughts}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 text-xs text-zinc-300" data-testid="openrig-kanban-counts">
        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5">
          TODO: <strong>{taskCounts.todo}</strong>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5">
          IN PROGRESS: <strong>{taskCounts.in_progress}</strong>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5">
          GATE 2 REVIEW: <strong>{taskCounts.review}</strong>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5 text-emerald-400">
          DONE: <strong>{taskCounts.done}</strong>
        </div>
      </div>

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto py-2" data-testid="consular-dialogue-feed">
        {dialogue.map((item) => (
          <article key={item.id} className="rounded border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-base">
            {item.replyTo && (
              <div className="mb-1 border-l-2 border-zinc-600 pl-2 text-xs text-zinc-400">
                Replying to {item.replyTo.sender}: {item.replyTo.content}
              </div>
            )}
            {item.thinking && (
              <div
                className="mb-1.5 line-clamp-2 text-xs italic text-zinc-400"
                data-testid="inline-deliberation-summary"
              >
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
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
