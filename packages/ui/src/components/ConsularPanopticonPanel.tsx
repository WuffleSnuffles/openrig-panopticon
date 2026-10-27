import React, { useEffect, useState } from "react";

export interface ConsulSummary {
  id: string;
  title: string;
  name: string;
  model: string;
  archetype?: string;
  epithet?: string;
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

export interface DialogueEntry {
  id: string;
  sender: string;
  content: string;
  phase: string;
  timestamp: string;
}

export interface ConsularGovernanceStatus {
  mode: string;
  engine: string;
  consuls: ConsulSummary[];
  cubicles: CubicleSeat[];
  tasks: {
    todo: number;
    in_progress: number;
    review: number;
    done: number;
    items?: {
      todo: any[];
      in_progress: any[];
      review: any[];
      done: any[];
    };
  };
  dialogue: DialogueEntry[];
  openrigSubsystems?: {
    seatLifecycle: { active: boolean; totalSeats: number };
    seatActivity: { active: boolean; rungs: string[] };
    healthDetectors: { schema: string; detectors: string[] };
    streamClassifier: { active: boolean; mode: string };
    seatRecapStore: { active: boolean; format: string };
    crashCart: { active: boolean; daemonState: string };
  };
  timestamp: string;
}

export const ConsularPanopticonPanel: React.FC<{ daemonUrl?: string }> = ({
  daemonUrl = "",
}) => {
  const [status, setStatus] = useState<ConsularGovernanceStatus | null>(null);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const r = await fetch(`${daemonUrl}/api/governance/status`);
      const data = await r.json();
      setStatus(data);
    } catch {}
  };

  useEffect(() => {
    void fetchStatus();
    const timer = setInterval(fetchStatus, 4000);
    return () => clearInterval(timer);
  }, [daemonUrl]);

  const sendDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`${daemonUrl}/api/governance/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setPrompt("");
      await fetchStatus();
    } finally {
      setSending(false);
    }
  };

  const triggerCrashCartRestore = async () => {
    try {
      const r = await fetch(`${daemonUrl}/api/governance/crash-cart/restore`, {
        method: "POST",
      });
      const data = await r.json();
      setRestoreNotice(`Crash-Cart Fleet Restore (${data.fleetAttemptId}): ${data.verdict}`);
    } catch {}
  };

  return (
    <section
      data-testid="consular-panopticon-panel"
      style={{
        border: "2px solid #ff2a6d",
        background: "#07070c",
        color: "#e0e6ed",
        padding: "16px",
        fontFamily: "monospace",
      }}
    >
      {/* Twin-Sauron & OpenRig Engine Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #ff2a6d",
          paddingBottom: "10px",
          marginBottom: "14px",
        }}
      >
        <div>
          <strong style={{ color: "#ff2a6d", letterSpacing: "0.08em", fontSize: "15px" }}>
            TWIN-SAURON PANOPTICON // ROMAN DUAL-CONSUL GOVERNANCE (OPENRIG ENGINE)
          </strong>
          <div style={{ fontSize: "11px", color: "#05d5fa", marginTop: "4px" }}>
            Subsystems Active: SeatLifecycle (Gen-Fenced) | 4-Rung Activity Ladder | 6 Health Detectors | Lease Stream Classifier | RECAP.md Store | Crash-Cart B1/C2/C3
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={triggerCrashCartRestore}
            style={{
              background: "#141424",
              color: "#05d5fa",
              border: "1px solid #05d5fa",
              padding: "6px 10px",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "11px",
            }}
          >
            CRASH-CART FLEET RESTORE (AMENDMENT 2)
          </button>
          <span style={{ color: "#05d5fa", fontSize: "12px" }}>
            {status?.engine || "openrig-panopticon-v1"}
          </span>
        </div>
      </header>

      {restoreNotice && (
        <div
          style={{
            background: "#0d2630",
            border: "1px solid #05d5fa",
            padding: "8px 12px",
            marginBottom: "12px",
            fontSize: "12px",
          }}
        >
          {restoreNotice}
        </div>
      )}

      {/* Dual Consuls Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
        {(status?.consuls || []).map((c) => (
          <div
            key={c.id}
            style={{
              border: "1px solid #2a2f45",
              padding: "10px",
              background: "#0e101a",
            }}
          >
            <div style={{ color: "#05d5fa", fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: "12px", opacity: 0.85 }}>
              {c.title} — {c.model} ({c.epithet || "Consul"})
            </div>
          </div>
        ))}
      </div>

      {/* Main 3-Zone Panopticon Layout: 16-Cubicle Matrix | Overseer Console | 4-Column Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr 1.1fr", gap: "14px" }}>
        {/* Left: 16-Cubicle Matrix */}
        <div style={{ border: "1px solid #2a2f45", padding: "10px", background: "#0b0d14" }}>
          <div style={{ color: "#ff2a6d", fontWeight: 700, marginBottom: "8px", fontSize: "12px" }}>
            16-CUBICLE MATRIX (OPENRIG SEAT LIFECYCLE & 4-RUNG EVIDENCE)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
            {(status?.cubicles || []).map((cub) => (
              <div
                key={cub.id}
                style={{
                  border: `1px solid ${cub.status === "working" ? "#05d5fa" : "#25293a"}`,
                  padding: "6px",
                  background: "#101320",
                  fontSize: "10px",
                }}
              >
                <div style={{ fontWeight: 700, color: cub.status === "working" ? "#05d5fa" : "#9aa5b1" }}>
                  {cub.id.toUpperCase()}
                </div>
                <div>{cub.status.toUpperCase()}</div>
                <div style={{ color: "#7b8794", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Rung: {cub.evidence_rung}
                </div>
                <div
                  style={{
                    color: "#cbd2d9",
                    marginTop: "3px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={cub.surface_thoughts}
                >
                  {cub.surface_thoughts}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Overseer Console */}
        <div
          style={{
            border: "1px solid #2a2f45",
            padding: "10px",
            background: "#0b0d14",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ color: "#05d5fa", fontWeight: 700, marginBottom: "8px", fontSize: "12px" }}>
              CONSULAR DIALOGUE & OVERSEER DIRECTIVES
            </div>
            <div style={{ maxHeight: "220px", overflowY: "auto", fontSize: "11px", display: "grid", gap: "6px" }}>
              {(status?.dialogue || []).slice(-8).map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    borderLeft: `2px solid ${msg.sender.includes("Nia") ? "#ff2a6d" : msg.sender.includes("Ferric") ? "#05d5fa" : "#f59e0b"}`,
                    paddingLeft: "8px",
                  }}
                >
                  <strong style={{ color: "#e0e6ed" }}>{msg.sender}: </strong>
                  <span>{msg.content}</span>
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={sendDirective} style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Issue directive to Consuls Nia & Ferric..."
              style={{
                flex: 1,
                background: "#141824",
                color: "#e0e6ed",
                border: "1px solid #2a2f45",
                padding: "6px 8px",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
            />
            <button
              type="submit"
              disabled={sending}
              style={{
                background: "#ff2a6d",
                color: "#fff",
                border: "none",
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              SEND
            </button>
          </form>
        </div>

        {/* Right: 4-Column Kanban Summary */}
        <div style={{ border: "1px solid #2a2f45", padding: "10px", background: "#0b0d14" }}>
          <div style={{ color: "#ff2a6d", fontWeight: 700, marginBottom: "8px", fontSize: "12px" }}>
            KANBAN TASKBOARD (GATE 1 & GATE 2)
          </div>
          {status?.tasks && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
              <div style={{ border: "1px solid #25293a", padding: "8px" }}>
                TODO: <strong>{status.tasks.todo}</strong>
              </div>
              <div style={{ border: "1px solid #25293a", padding: "8px" }}>
                IN PROGRESS: <strong>{status.tasks.in_progress}</strong>
              </div>
              <div style={{ border: "1px solid #25293a", padding: "8px" }}>
                GATE 2 REVIEW: <strong>{status.tasks.review}</strong>
              </div>
              <div style={{ border: "1px solid #25293a", padding: "8px", color: "#10b981" }}>
                DONE: <strong>{status.tasks.done}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
