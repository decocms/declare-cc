import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../components/toast";

const GRAPH_KEY = ["graph"] as const;
const AGENTS_KEY = ["agents"] as const;

export function useGraph() {
  return useQuery({
    queryKey: GRAPH_KEY,
    queryFn: async () => {
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error(`Graph API error: ${res.status}`);
      return res.json();
    },
    retry: 1,
    placeholderData: (prev: any) => prev,
  });
}

export function useApprove() {
  const toast = useToast();
  return useMutation({
    mutationFn: (ids: string[]) =>
      fetch("/api/approve-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }).then((r) => r.json()),
    onError: (err: Error) => toast.show(err.message, "error"),
  });
}

export function useDeleteNode() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) => {
      const prefix = type === "declaration" ? "declarations" : type === "milestone" ? "milestones" : "actions";
      return fetch(`/api/${prefix}/${id}`, { method: "DELETE" }).then((r) => r.json());
    },
    onError: (err: Error) => toast.show(err.message, "error"),
  });
}

export function useUpdateNode() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, type, data }: { id: string; type: string; data: Record<string, unknown> }) => {
      const prefix = type === "declaration" ? "declarations" : type === "milestone" ? "milestones" : "actions";
      return fetch(`/api/${prefix}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json());
    },
    onError: (err: Error) => toast.show(err.message, "error"),
  });
}

/** Subscribe to SSE events and auto-refetch graph + agents (debounced) */
export function useSSE() {
  const qc = useQueryClient();
  const graphTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource("/events");

    function debouncedGraphRefetch() {
      if (graphTimer.current) clearTimeout(graphTimer.current);
      graphTimer.current = setTimeout(() => {
        graphTimer.current = null;
        qc.invalidateQueries({ queryKey: GRAPH_KEY });
      }, 150);
    }

    function debouncedAgentsRefetch() {
      if (agentsTimer.current) clearTimeout(agentsTimer.current);
      agentsTimer.current = setTimeout(() => {
        agentsTimer.current = null;
        qc.invalidateQueries({ queryKey: AGENTS_KEY });
      }, 300);
    }

    es.addEventListener("change", debouncedGraphRefetch);
    es.addEventListener("agent-start", debouncedAgentsRefetch);
    es.addEventListener("agent-complete", debouncedAgentsRefetch);
    es.addEventListener("agent-output", debouncedAgentsRefetch);

    es.onerror = () => {};
    return () => {
      es.close();
      if (graphTimer.current) clearTimeout(graphTimer.current);
      if (agentsTimer.current) clearTimeout(agentsTimer.current);
    };
  }, [qc]);
}
