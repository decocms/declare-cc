import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
    queryFn: (): Promise<Agent[]> => fetch("/api/agents").then((r) => r.json()),
    refetchInterval: 3000,
  });
}

export function useSpawnAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { endpoint: string; body: Record<string, unknown> }) =>
      fetch(`/api/agents/${opts.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts.body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENTS_KEY }),
  });
}
