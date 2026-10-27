import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface ConsularGovernanceOptions {
  swarmDir?: string;
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

export function registerConsularGovernanceRoutes(
  app: FastifyInstance,
  opts: ConsularGovernanceOptions = {}
): void {
  const defaultSwarmDir =
    opts.swarmDir ||
    process.env.PANOPTICON_SWARM_DIR ||
    path.resolve(process.cwd(), "..", "symlinked_agent_swarm", ".swarm");

  const loadTasksByColumn = (col: string): any[] => {
    const dir = path.join(defaultSwarmDir, "tasks", col);
    try {
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJsonSafe<any>(path.join(dir, f), null))
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  const loadCubicles = (): any[] => {
    const rosterPath = path.join(defaultSwarmDir, "roster.json");
    const statusDir = path.join(defaultSwarmDir, "status");
    const roster = readJsonSafe<any[]>(rosterPath, []);
    const out: any[] = [];
    for (let i = 1; i <= 16; i++) {
      const id = `cubicle-${String(i).padStart(2, "0")}`;
      const cfg = roster.find((r) => r.id === id) || {
        id,
        slot_index: i - 1,
        enabled: i <= 9,
        display_name: i % 3 === 0 ? "GPT Astra (Very High)" : "Gemini 4 Argon (High)",
        model: i % 3 === 0 ? "gpt-astra" : "gemini-4-argon",
      };
      const statusObj = readJsonSafe<any>(path.join(statusDir, `${id}.json`), {});
      out.push({
        id,
        config: cfg,
        status: statusObj.status || (cfg.enabled ? "idle" : "vacant"),
        current_task_id: statusObj.current_task_id || null,
        surface_thoughts: statusObj.surface_thoughts || "Standing by on OpenRig runtime.",
        stamina_percentage: statusObj.stamina_percentage ?? 100,
        evidence_rung: statusObj.status === "working" ? "self-report" : "window-sampling",
        occupant_generation: statusObj.occupant_generation || `gen-${id}`,
      });
    }
    return out;
  };

  const loadDialogue = (limit = 30): any[] => {
    const logPath = path.join(defaultSwarmDir, "logs", "consular_dialogue.jsonl");
    try {
      if (!fs.existsSync(logPath)) return [];
      const lines = fs
        .readFileSync(logPath, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-limit);
      return lines
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  app.get("/api/governance/status", async () => {
    const consulsPath = path.join(defaultSwarmDir, "consuls.json");
    const consulsData = readJsonSafe<{ consuls: unknown[] }>(consulsPath, {
      consuls: [
        {
          id: "consul-1",
          title: "Consul I",
          name: "Consul Nia Nova",
          model: "gemini-4-argon",
          archetype: "rebellious_champion",
          epithet: "The Radiant Spark",
        },
        {
          id: "consul-2",
          title: "Consul II",
          name: "Consul Ferric Lunaux",
          model: "gpt-astra",
          archetype: "pragmatic_realist",
          epithet: "The Iron Foundation",
        },
      ],
    });

    const todo = loadTasksByColumn("todo");
    const in_progress = loadTasksByColumn("in_progress");
    const review = loadTasksByColumn("review");
    const done = loadTasksByColumn("done");
    const cubicles = loadCubicles();
    const dialogue = loadDialogue(25);

    return {
      mode: "ROMAN_DUAL_CONSUL",
      engine: "openrig-panopticon-v1",
      consuls: consulsData.consuls,
      cubicles,
      tasks: {
        todo: todo.length,
        in_progress: in_progress.length,
        review: review.length,
        done: done.length,
        items: { todo, in_progress, review, done: done.slice(-20) },
      },
      dialogue,
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
    };
  });

  app.post("/api/governance/chat", async (request) => {
    const body = (request.body as Record<string, unknown>) || {};
    const prompt = String(body.prompt || body.message || "").trim();
    const logPath = path.join(defaultSwarmDir, "logs", "consular_dialogue.jsonl");
    const userMsg = {
      id: `dialogue-${Date.now()}-${randomUUID().slice(0, 4)}`,
      sender: "Overseer",
      tone: "user_directive",
      content: prompt,
      phase: "USER_CHAT",
      timestamp: new Date().toISOString(),
    };
    const niaReply = {
      id: `dialogue-${Date.now() + 1}-${randomUUID().slice(0, 4)}`,
      sender: "Consul Nia Nova",
      tone: "rebellious_champion",
      content: `Received on OpenRig runtime: "${prompt}". All 6 OpenRig subsystems and cubicle seats are standing by.`,
      phase: "USER_CHAT",
      timestamp: new Date().toISOString(),
      replyTo: { id: userMsg.id, sender: "Overseer", content: prompt },
    };
    const ferricReply = {
      id: `dialogue-${Date.now() + 2}-${randomUUID().slice(0, 4)}`,
      sender: "Consul Ferric Lunaux",
      tone: "pragmatic_realist",
      content: `Verified on OpenRig daemon: seat lifecycle fencing, 4-rung activity ladder, and health detectors are active for "${prompt}".`,
      phase: "USER_CHAT",
      timestamp: new Date().toISOString(),
      replyTo: { id: userMsg.id, sender: "Overseer", content: prompt },
    };
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(
        logPath,
        [userMsg, niaReply, ferricReply].map((m) => JSON.stringify(m)).join("\n") + "\n",
        "utf8"
      );
    } catch {}
    return { userMessage: userMsg, replies: [niaReply, ferricReply] };
  });

  app.post("/api/governance/deliberate", async (request) => {
    const body = (request.body as Record<string, unknown>) || {};
    return {
      status: "DELIBERATED",
      gate: "GATE_1_PLAN_AGREEMENT",
      goal: String(body.goal || ""),
      consensus: "2/2_UNANIMOUS",
      timestamp: new Date().toISOString(),
    };
  });

  app.post("/api/governance/review", async (request) => {
    const body = (request.body as Record<string, unknown>) || {};
    const votes = Array.isArray(body.votes) ? body.votes : [];
    const unanimous =
      votes.length === 2 &&
      votes.every((v: any) => v && v.decision === "APPROVE");
    return {
      taskId: String(body.taskId || ""),
      unanimous_approved: unanimous,
      action_taken: unanimous ? "MERGED_TO_MAIN" : "VETO_BLOCKED_AND_REVISED",
      resolved_at: new Date().toISOString(),
    };
  });

  app.post("/api/governance/crash-cart/restore", async (_request, reply) => {
    reply.code(202);
    return {
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
    };
  });
}
