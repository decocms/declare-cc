---
description: Open the interactive DAG dashboard in the browser (starts the server if needed)
allowed-tools:
  - Bash
---

Open the Declare interactive DAG dashboard — a live web UI showing declarations, milestones, and actions as a navigable graph.

**Step 1: Check if the server is already running.**

```bash
curl -sf http://localhost:3847/api/graph -o /dev/null && echo "RUNNING" || echo "NOT_RUNNING"
```

**Step 2: Start the server if it is not running.**

If the output from Step 1 is `NOT_RUNNING`:

Start the server in the background, capturing its PID:

```bash
nohup node dist/declare-tools.cjs serve --port 3847 > /tmp/declare-dashboard.log 2>&1 &
echo $!
```

Then wait briefly and confirm it started:

```bash
sleep 1 && curl -sf http://localhost:3847/api/graph -o /dev/null && echo "STARTED" || echo "FAILED"
```

If the result is `FAILED`, report the error and show the last lines of the log:

```bash
tail -20 /tmp/declare-dashboard.log
```

**Step 3: Open the dashboard in the browser.**

Detect the OS and open the URL:

```bash
if [[ "$OSTYPE" == "darwin"* ]]; then
  open http://localhost:3847
else
  xdg-open http://localhost:3847 2>/dev/null || echo "Visit http://localhost:3847 in your browser"
fi
```

**Step 4: Confirm to the user.**

Show the user:

```
Dashboard running at http://localhost:3847

The graph auto-refreshes every 5 seconds.
Click any node to inspect its details.

Server log: /tmp/declare-dashboard.log
To stop:    kill <PID>
```

Where `<PID>` is the process ID captured in Step 2 (or a reminder to find it with `lsof -ti :3847`).

If the server was already running (Step 1 returned `RUNNING`), say "Server was already running."

**Step 5: Tail server output (optional).**

If `$ARGUMENTS` contains `--tail` or `--log`:

```bash
tail -f /tmp/declare-dashboard.log
```

Otherwise, skip this step.
