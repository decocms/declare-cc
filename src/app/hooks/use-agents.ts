import { useQuery, useMutation } from "@tanstack/react-query";

const AGENTS_KEY = ["agents"] as const;

export interface Agent {
  id: string;
  type: string;
  status: "running" | "completed" | "failed" | "interrupted";
  prompt: string;
  context: string;
  output: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export function useAgents() {
  return useQuery({
    queryKey: AGENTS_KEY,
    queryFn: async (): Promise<Agent[]> => {
      const res = await fetch("/api/agents");
      if (!res.ok) return [];
      return res.json();
    },
    // No polling — SSE triggers refetch via invalidation
    refetchInterval: false,
    retry: false,
  });
}

export function useSpawnAgent() {
  return useMutation({
    mutationFn: (opts: { endpoint: string; body: Record<string, unknown> }) =>
      fetch(`/api/agents/${opts.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts.body),
      }).then((r) => r.json()),
    // Don't invalidate here — SSE "agent-start" event will trigger refetch
  });
}
