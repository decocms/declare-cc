---
description: Open the interactive DAG dashboard in the browser (starts the server if needed)
allowed-tools:
  - Bash
---

Open the Declare interactive DAG dashboard — a live web UI showing declarations, milestones, and actions as a navigable graph.

**Step 1: Resolve the port for this project.**

Each project gets its own stable port derived from the project path. Check if it's already been assigned:

```bash
cat .planning/server.port 2>/dev/null || echo "NOT_SET"
```

If a port file exists, use that port. If not, the SessionStart hook hasn't fired yet — use the default port 3847 and set PORT to it.

```bash
PORT=$(cat .planning/server.port 2>/dev/null || echo "3847")
echo "PORT=$PORT"
```

**Step 2: Check if the server is already running on that port.**

```bash
curl -sf http://localhost:${PORT}/api/graph -o /dev/null && echo "RUNNING" || echo "NOT_RUNNING"
```

**Step 3: Start the server if it is not running.**

If `NOT_RUNNING`:

```bash
nohup node dist/declare-tools.cjs serve --port ${PORT} > /tmp/declare-dashboard.log 2>&1 &
sleep 1 && curl -sf http://localhost:${PORT}/api/graph -o /dev/null && echo "STARTED" || echo "FAILED"
```

If `FAILED`:
```bash
tail -20 /tmp/declare-dashboard.log
```

**Step 4: Open the dashboard in the browser.**

```bash
if [[ "$OSTYPE" == "darwin"* ]]; then
  open http://localhost:${PORT}
else
  xdg-open http://localhost:${PORT} 2>/dev/null || echo "Visit http://localhost:${PORT} in your browser"
fi
```

**Step 5: Confirm to the user.**

```
Dashboard running at http://localhost:[PORT]

The graph updates live as agents run and files change.
Click any node to inspect details and exec-plan.

To stop: kill $(lsof -ti :[PORT])
```

If the server was already running (Step 2 returned `RUNNING`), say "Server was already running."
