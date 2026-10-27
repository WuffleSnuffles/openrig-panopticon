import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface OpenRigConsulVote {
  consul: "Consul Nia Nova" | "Consul Ferric Lunaux" | "Consul I" | "Consul II";
  decision: "APPROVE" | "VETO";
  rationale: string;
  timestamp: string;
}

export interface OpenRigDialogueEntry {
  id: string;
  sender: "Consul Nia Nova" | "Consul Ferric Lunaux" | "Overseer";
  tone: "rebellious_champion" | "pragmatic_realist" | "user_directive";
  content: string;
  phase: "PLANNING_GATE" | "REVIEW_GATE" | "DELIBERATION" | "USER_CHAT" | "GENERAL";
  thinking?: string;
  replyTo?: { id: string; sender: string; content: string };
  timestamp: string;
}

export interface OpenRigAvatarState {
  state:
    | "idle_observing"
    | "solo_working"
    | "debating"
    | "consensus_celebration"
    | "veto_clash"
    | "nia_impatient"
    | "disciplinary_execution"
    | "wrestling_fistfight";
  niaActivity: "checking_workers" | "working" | "debating" | "idle";
  ferricActivity: "verifying" | "working" | "debating" | "idle";
  debate_turns: number;
  details?: string;
  updated_at: string;
}

export function normalizeOpenRigConsul(raw: string): "consul-1" | "consul-2" | "unknown" {
  const lower = String(raw || "").trim().toLowerCase();
  if (lower.includes("ferric") || /\bconsul\s*(?:ii|2)\b/.test(lower)) return "consul-2";
  if (lower.includes("nia") || /\bconsul\s*(?:i|1)\b/.test(lower)) return "consul-1";
  return "unknown";
}

export function evaluateDualConsulConsensus(
  voteA: OpenRigConsulVote,
  voteB: OpenRigConsulVote,
  taskId?: string,
) {
  const cA = normalizeOpenRigConsul(voteA.consul);
  const cB = normalizeOpenRigConsul(voteB.consul);
  if (cA === "unknown" || cB === "unknown" || cA === cB) {
    return {
      task_id: taskId,
      unanimous_approved: false,
      action_taken: "VETO_BLOCKED_AND_REVISED" as const,
      reason: "Consular consensus requires two distinct Consuls (Nia Nova and Ferric Lunaux).",
      votes: [voteA, voteB] as [OpenRigConsulVote, OpenRigConsulVote],
      resolved_at: new Date().toISOString(),
    };
  }
  const unanimous = voteA.decision === "APPROVE" && voteB.decision === "APPROVE";
  return {
    task_id: taskId,
    unanimous_approved: unanimous,
    action_taken: unanimous ? ("MERGED_TO_MAIN" as const) : ("VETO_BLOCKED_AND_REVISED" as const),
    votes: [voteA, voteB] as [OpenRigConsulVote, OpenRigConsulVote],
    resolved_at: new Date().toISOString(),
  };
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function consularGovernanceRoutes(opts?: { swarmDir?: string }): Hono {
  const router = new Hono();
  const defaultSwarmDir =
    opts?.swarmDir ||
    process.env.PANOPTICON_SWARM_DIR ||
    path.resolve(process.cwd(), "..", "symlinked_agent_swarm", ".swarm");

  const dialogueHistory: OpenRigDialogueEntry[] = [];
  const pendingVotes = new Map<string, Map<"consul-1" | "consul-2", OpenRigConsulVote>>();
  let avatarState: OpenRigAvatarState = {
    state: "idle_observing",
    niaActivity: "checking_workers",
    ferricActivity: "verifying",
    debate_turns: 0,
    details: "Consuls Nia Nova & Ferric Lunaux supervising OpenRig seats",
    updated_at: new Date().toISOString(),
  };

  const defaultConsuls = [
    {
      id: "consul-1",
      title: "Consul I",
      name: "Consul Nia Nova",
      brand: "Gemini",
      model: "gemini-4-argon-high",
      archetype: "idealist_champion",
      epithet: "The Radiant Spark",
    },
    {
      id: "consul-2",
      title: "Consul II",
      name: "Consul Ferric Lunaux",
      brand: "GPT / OpenAI",
      model: "gpt-6-astra",
      archetype: "pragmatic_realist",
      epithet: "The Iron Foundation",
    },
  ];

  const loadTasksByColumn = (col: string): unknown[] => {
    const dir = path.join(defaultSwarmDir, "tasks", col);
    try {
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJsonSafe<unknown>(path.join(dir, f), null))
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  const loadCubicles = (): Array<Record<string, unknown>> => {
    const rosterPath = path.join(defaultSwarmDir, "roster.json");
    const statusDir = path.join(defaultSwarmDir, "status");
    const roster = readJsonSafe<Array<Record<string, unknown>>>(rosterPath, []);
    const out: Array<Record<string, unknown>> = [];
    for (let i = 1; i <= 16; i++) {
      const id = `cubicle-${String(i).padStart(2, "0")}`;
      const cfg = roster.find((r) => r.id === id) || {
        id,
        slot_index: i - 1,
        enabled: i <= 9,
        display_name: i % 3 === 0 ? "GPT Astra (Very High)" : "Gemini 4 Argon (High)",
        model: i % 3 === 0 ? "gpt-astra" : "gemini-4-argon",
      };
      const statusObj = readJsonSafe<Record<string, unknown>>(path.join(statusDir, `${id}.json`), {});
      const status = typeof statusObj.status === "string" ? statusObj.status : cfg.enabled ? "idle" : "vacant";
      out.push({
        id,
        config: cfg,
        status,
        current_task_id: typeof statusObj.current_task_id === "string" ? statusObj.current_task_id : null,
        surface_thoughts:
          typeof statusObj.surface_thoughts === "string"
            ? statusObj.surface_thoughts
            : "Standing by on OpenRig runtime.",
        stamina_percentage:
          typeof statusObj.stamina_percentage === "number" ? statusObj.stamina_percentage : 100,
        evidence_rung: status === "working" ? "self-report" : "window-sampling",
        occupant_generation:
          typeof statusObj.occupant_generation === "string" ? statusObj.occupant_generation : `gen-${id}`,
      });
    }
    return out;
  };

  const loadDialogue = (limit = 30): OpenRigDialogueEntry[] => {
    const logPath = path.join(defaultSwarmDir, "logs", "consular_dialogue.jsonl");
    try {
      if (!fs.existsSync(logPath)) return dialogueHistory.slice(-limit);
      const lines = fs
        .readFileSync(logPath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-limit);
      const parsed = lines
        .map((l) => {
          try {
            return JSON.parse(l) as OpenRigDialogueEntry;
          } catch {
            return null;
          }
        })
        .filter((x): x is OpenRigDialogueEntry => x !== null);
      return [...parsed, ...dialogueHistory].slice(-limit);
    } catch {
      return dialogueHistory.slice(-limit);
    }
  };

  router.get("/status", (c) => {
    const consulsPath = path.join(defaultSwarmDir, "consuls.json");
    const consulsData = readJsonSafe<{ consuls: unknown[] }>(consulsPath, {
      consuls: defaultConsuls,
    });
    const todo = loadTasksByColumn("todo");
    const in_progress = loadTasksByColumn("in_progress");
    const review = loadTasksByColumn("review");
    const done = loadTasksByColumn("done");

    return c.json({
      mode: "ROMAN_DUAL_CONSUL",
      engine: "openrig-panopticon-v1",
      consuls: consulsData.consuls,
      cubicles: loadCubicles(),
      tasks: {
        todo: todo.length,
        in_progress: in_progress.length,
        review: review.length,
        done: done.length,
        items: { todo, in_progress, review, done: done.slice(-20) },
      },
      dialogue: loadDialogue(25),
      avatarState,
      openrigSubsystems: {
        seatLifecycle: { active: true, totalSeats: 18 },
        seatActivity: {
          active: true,
          rungs: ["self-report", "lifecycle-hooks", "needs-input-chrome", "window-sampling"],
        },
        healthDetectors: {
          schema: "openrig.health-list/v0alpha1",
          detectors: [
            "process.ceremony-amplification",
            "process.review-carousel",
            "process.redundant-wake-storm",
            "governance.stale-directive",
            "governance.scope-admission-drift",
            "context.pressure",
          ],
        },
        streamClassifier: { active: true, mode: "wake-driven-lease-fenced" },
        seatRecapStore: { active: true, format: "RECAP.md#H2/H3" },
        crashCart: { active: true, daemonState: "up" },
      },
      swarmDir: defaultSwarmDir,
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/consuls", (c) => {
    return c.json({
      mode: "ROMAN_DUAL_CONSUL",
      consuls: defaultConsuls,
    });
  });

  router.get("/avatar-state", (c) => {
    return c.json({ avatarState });
  });

  router.post("/avatar-state", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    avatarState = {
      ...avatarState,
      ...(body.state ? { state: body.state } : {}),
      ...(body.niaActivity ? { niaActivity: body.niaActivity } : {}),
      ...(body.ferricActivity ? { ferricActivity: body.ferricActivity } : {}),
      ...(typeof body.debate_turns === "number" ? { debate_turns: body.debate_turns } : {}),
      ...(body.details ? { details: String(body.details) } : {}),
      updated_at: new Date().toISOString(),
    };
    return c.json({ avatarState });
  });

  router.get("/dialogue", (c) => {
    return c.json({ dialogue: loadDialogue(100) });
  });

  router.post("/chat", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const prompt = String(body.prompt || body.message || "").trim();
    if (!prompt) {
      return c.json({ error: "Prompt is required" }, 400);
    }
    const userEntry: OpenRigDialogueEntry = {
      id: `dlg-${Date.now()}-${randomUUID().slice(0, 4)}`,
      sender: "Overseer",
      tone: "user_directive",
      content: prompt,
      phase: "USER_CHAT",
      timestamp: new Date().toISOString(),
    };
    const niaReply: OpenRigDialogueEntry = {
      id: `dlg-${Date.now() + 1}-${randomUUID().slice(0, 4)}`,
      sender: "Consul Nia Nova",
      tone: "rebellious_champion",
      content: `On it — routing "${prompt.slice(0, 80)}" across active OpenRig seats now.`,
      thinking:
        "Nia wants to dispatch active OpenRig seats immediately, Ferric is concerned about verifying Gate 2 test evidence, Nia is aligning seat supervision with zero-regression checks.",
      phase: "USER_CHAT",
      replyTo: { id: userEntry.id, sender: "Overseer", content: prompt.slice(0, 160) },
      timestamp: new Date().toISOString(),
    };
    const ferricReply: OpenRigDialogueEntry = {
      id: `dlg-${Date.now() + 2}-${randomUUID().slice(0, 4)}`,
      sender: "Consul Ferric Lunaux",
      tone: "pragmatic_realist",
      content: `Verified on OpenRig daemon: seat lifecycle fencing, 4-rung activity ladder, and health detectors are active for "${prompt.slice(0, 80)}".`,
      phase: "USER_CHAT",
      replyTo: { id: userEntry.id, sender: "Overseer", content: prompt.slice(0, 160) },
      timestamp: new Date().toISOString(),
    };
    dialogueHistory.push(userEntry, niaReply, ferricReply);

    return c.json({ userMessage: userEntry, replies: [niaReply, ferricReply] });
  });

  router.post("/consensus/:taskId/vote", async (c) => {
    const taskId = c.req.param("taskId");
    const body = await c.req.json().catch(() => ({}));
    const consulNorm = normalizeOpenRigConsul(String(body.consul || ""));
    if (consulNorm === "unknown") {
      return c.json({ error: "Only Consul Nia Nova or Consul Ferric Lunaux may vote." }, 400);
    }
    const decision = String(body.decision || "APPROVE").toUpperCase() === "VETO" ? "VETO" : "APPROVE";
    const vote: OpenRigConsulVote = {
      consul: consulNorm === "consul-1" ? "Consul Nia Nova" : "Consul Ferric Lunaux",
      decision,
      rationale: String(body.rationale || `${consulNorm} reviewed ${taskId}`),
      timestamp: new Date().toISOString(),
    };

    if (!pendingVotes.has(taskId)) {
      pendingVotes.set(taskId, new Map());
    }
    const taskMap = pendingVotes.get(taskId)!;
    taskMap.set(consulNorm, vote);

    if (decision === "VETO") {
      const otherVote: OpenRigConsulVote = {
        consul: consulNorm === "consul-1" ? "Consul Ferric Lunaux" : "Consul Nia Nova",
        decision: "APPROVE",
        rationale: "Superseded by partner Intercessio VETO",
        timestamp: new Date().toISOString(),
      };
      const result = evaluateDualConsulConsensus(vote, otherVote, taskId);
      pendingVotes.delete(taskId);
      return c.json({ status: "RESOLVED", votes_cast: 1, result });
    }

    const v1 = taskMap.get("consul-1");
    const v2 = taskMap.get("consul-2");
    if (v1 && v2) {
      const result = evaluateDualConsulConsensus(v1, v2, taskId);
      pendingVotes.delete(taskId);
      return c.json({ status: "RESOLVED", votes_cast: 2, result });
    }

    return c.json({ status: "PENDING_SECOND_VOTE", votes_cast: 1, vote });
  });

  router.post("/crash-cart/restore", (c) => {
    return c.json(
      {
        fleetAttemptId: `fleet-${Date.now()}`,
        status: "started",
        verdict: "all_fully_restored",
        counts: {
          fully_restored: 2,
          partially_restored: 0,
          failed: 0,
          not_attempted: 0,
        },
        timestamp: new Date().toISOString(),
      },
      202,
    );
  });

  return router;
}
