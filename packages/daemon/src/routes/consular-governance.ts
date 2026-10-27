import { Hono } from "hono";

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

export function consularGovernanceRoutes(): Hono {
  const router = new Hono();
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

  router.get("/consuls", (c) => {
    return c.json({
      mode: "ROMAN_DUAL_CONSUL",
      consuls: [
        {
          id: "consul-1",
          title: "Consul I",
          name: "Consul Nia Nova",
          brand: "Gemini",
          model: "gemini-4-argon-high",
          archetype: "idealist_champion",
        },
        {
          id: "consul-2",
          title: "Consul II",
          name: "Consul Ferric Lunaux",
          brand: "GPT / OpenAI",
          model: "gpt-6-astra",
          archetype: "pragmatic_realist",
        },
      ],
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
    return c.json({ dialogue: dialogueHistory.slice(-100) });
  });

  router.post("/chat", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const prompt = String(body.prompt || body.message || "").trim();
    if (!prompt) {
      return c.json({ error: "Prompt is required" }, 400);
    }
    const userEntry: OpenRigDialogueEntry = {
      id: `dlg-${Date.now()}-user`,
      sender: "Overseer",
      tone: "user_directive",
      content: prompt,
      phase: "USER_CHAT",
      timestamp: new Date().toISOString(),
    };
    dialogueHistory.push(userEntry);

    const niaReply: OpenRigDialogueEntry = {
      id: `dlg-${Date.now()}-nia`,
      sender: "Consul Nia Nova",
      tone: "rebellious_champion",
      content: `On it — routing "${prompt.slice(0, 80)}" across active OpenRig seats now.`,
      thinking:
        "Nia wants to dispatch active OpenRig seats immediately, Ferric is concerned about verifying Gate 2 test evidence, Nia is aligning seat supervision with zero-regression checks.",
      phase: "USER_CHAT",
      replyTo: { id: userEntry.id, sender: "Overseer", content: prompt.slice(0, 160) },
      timestamp: new Date().toISOString(),
    };
    dialogueHistory.push(niaReply);

    return c.json({ userMessage: userEntry, replies: [niaReply] });
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

  return router;
}
