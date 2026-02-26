import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const GRAPH_KEY = ["graph"] as const;

export function useGraph() {
  return useQuery({
    queryKey: GRAPH_KEY,
    queryFn: () => fetch("/api/graph").then((r) => r.json()),
    refetchInterval: false,
  });
}

export function useApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      fetch("/api/approve-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: GRAPH_KEY }),
  });
}

export function useDeleteNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => {
      const prefix = type === "declaration" ? "declarations" : type === "milestone" ? "milestones" : "actions";
      return fetch(`/api/${prefix}/${id}`, { method: "DELETE" }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: GRAPH_KEY }),
  });
}

export function useUpdateNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, type, data }: { id: string; type: string; data: Record<string, unknown> }) => {
      const prefix = type === "declaration" ? "declarations" : type === "milestone" ? "milestones" : "actions";
      return fetch(`/api/${prefix}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: GRAPH_KEY }),
  });
}

/** Subscribe to SSE events and auto-refetch graph */
export function useSSE() {
  const qc = useQueryClient();

  // Only set up once via a query that never refetches
  useQuery({
    queryKey: ["sse"],
    queryFn: () => {
      const es = new EventSource("/events");
      es.addEventListener("change", () => {
        qc.invalidateQueries({ queryKey: GRAPH_KEY });
      });
      return { connected: true };
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
