#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/git/commit.js
var require_commit = __commonJS({
  "src/git/commit.js"(exports2, module2) {
    "use strict";
    var { execFileSync } = require("node:child_process");
    var { readFileSync, existsSync } = require("node:fs");
    var { join } = require("node:path");
    function execGit(cwd, args) {
      try {
        const stdout = execFileSync("git", args, {
          cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"]
        });
        return { exitCode: 0, stdout: stdout.trim(), stderr: "" };
      } catch (err) {
        return {
          exitCode: err.status || 1,
          stdout: (err.stdout || "").trim(),
          stderr: (err.stderr || "").trim()
        };
      }
    }
    function loadConfig(cwd) {
      const configPath = join(cwd, ".planning", "config.json");
      if (!existsSync(configPath)) {
        return { commit_docs: true };
      }
      try {
        const raw = readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        return { commit_docs: true, ...parsed };
      } catch {
        return { commit_docs: true };
      }
    }
    function isGitIgnored(cwd, path) {
      const result = execGit(cwd, ["check-ignore", "-q", path]);
      return result.exitCode === 0;
    }
    function commitPlanningDocs2(cwd, message, files) {
      const config = loadConfig(cwd);
      if (!config.commit_docs) {
        return { committed: false, reason: "skipped_config" };
      }
      if (isGitIgnored(cwd, ".planning")) {
        return { committed: false, reason: "skipped_gitignored" };
      }
      const filesToStage = files.length > 0 ? files : [".planning/"];
      for (const file of filesToStage) {
        const addResult = execGit(cwd, ["add", file]);
        if (addResult.exitCode !== 0) {
          return { committed: false, reason: "error", error: `Failed to stage ${file}: ${addResult.stderr}` };
        }
      }
      const result = execGit(cwd, ["commit", "-m", message]);
      if (result.exitCode !== 0) {
        const combined = result.stdout + " " + result.stderr;
        if (combined.includes("nothing to commit") || combined.includes("nothing added to commit")) {
          return { committed: false, reason: "nothing_to_commit" };
        }
        return { committed: false, reason: "error", error: result.stderr || result.stdout };
      }
      const hashResult = execGit(cwd, ["rev-parse", "--short", "HEAD"]);
      return { committed: true, hash: hashResult.stdout };
    }
    module2.exports = { commitPlanningDocs: commitPlanningDocs2, loadConfig, execGit };
  }
});

// src/artifacts/state.js
var require_state = __commonJS({
  "src/artifacts/state.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    function statePath(cwd) {
      return path.join(cwd, ".planning", "STATE.md");
    }
    function readState2(cwd) {
      const filePath = statePath(cwd);
      if (!fs.existsSync(filePath)) return null;
      const raw = fs.readFileSync(filePath, "utf8");
      function extractSection(text, heading) {
        const pattern = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=## |$)`, "i");
        const match = text.match(pattern);
        return match ? match[1].trim() : "";
      }
      return {
        raw,
        currentPosition: extractSection(raw, "Current Position"),
        recentWork: extractSection(raw, "Recent Work"),
        decisions: extractSection(raw, "Decisions Made"),
        blockers: extractSection(raw, "Blockers"),
        sessionHistory: extractSection(raw, "Session History")
      };
    }
    function writeState(cwd, data) {
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) {
        fs.mkdirSync(planningDir, { recursive: true });
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const content = buildStateContent(today, data);
      fs.writeFileSync(statePath(cwd), content, "utf8");
    }
    function buildStateContent(date, data) {
      const {
        currentPosition = "Project initialized",
        recentWork = "(none yet)",
        decisions = "| Decision | Rationale | Date |\n|----------|-----------|------|\n",
        blockers = "(none)",
        sessionHistory = "| Date | Stopped At | Resume File |\n|------|------------|-------------|"
      } = data;
      return [
        "# Project State",
        "",
        `**Last Updated:** ${date}`,
        `**Current Position:** ${currentPosition}`,
        "",
        "## Recent Work",
        "",
        recentWork,
        "",
        "## Decisions Made",
        "",
        decisions,
        "",
        "## Blockers",
        "",
        blockers,
        "",
        "## Session History",
        "",
        sessionHistory,
        ""
      ].join("\n");
    }
    function recordSession2(cwd, stoppedAt, resumeFile) {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const resumeValue = resumeFile || "\u2014";
      const newRow = `| ${today} | ${stoppedAt} | ${resumeValue} |`;
      const filePath = statePath(cwd);
      if (!fs.existsSync(filePath)) {
        writeState(cwd, {
          currentPosition: stoppedAt,
          sessionHistory: `| Date | Stopped At | Resume File |
|------|------------|-------------|
${newRow}`
        });
        return { ok: true, path: filePath };
      }
      let content = fs.readFileSync(filePath, "utf8");
      content = content.replace(
        /\*\*Last Updated:\*\*[^\n]*/,
        `**Last Updated:** ${today}`
      );
      content = content.replace(
        /\*\*Current Position:\*\*[^\n]*/,
        `**Current Position:** ${stoppedAt}`
      );
      const sessionTablePattern = /## Session History\s*\n([\s\S]*?)(?=## |$)/i;
      const match = content.match(sessionTablePattern);
      if (match) {
        const existingSection = match[1];
        const updatedSection = existingSection.trimEnd() + "\n" + newRow + "\n";
        content = content.replace(sessionTablePattern, `## Session History

${updatedSection}
`);
      } else {
        content += `
## Session History

| Date | Stopped At | Resume File |
|------|------------|-------------|
${newRow}
`;
      }
      fs.writeFileSync(filePath, content, "utf8");
      return { ok: true, path: filePath };
    }
    module2.exports = { readState: readState2, writeState, recordSession: recordSession2 };
  }
});

// src/artifacts/future.js
var require_future = __commonJS({
  "src/artifacts/future.js"(exports2, module2) {
    "use strict";
    function extractField(lines, field) {
      const pattern = new RegExp(`^\\*\\*${field}:\\*\\*`, "i");
      const line = lines.find((l) => pattern.test(l.trim()));
      if (!line) return null;
      return line.trim().replace(/^\*\*[^:]+:\*\*\s*/, "").trim();
    }
    function parseFutureFile(content) {
      if (!content || !content.trim()) return [];
      const declarations = [];
      const sections = content.split(/^## /m).slice(1);
      for (const section of sections) {
        const lines = section.trim().split("\n");
        const headerMatch = lines[0].match(/^(D-\d+):\s*(.+)/);
        if (!headerMatch) continue;
        const [, id, title] = headerMatch;
        const statement = extractField(lines, "Statement") || "";
        const rawStatus = extractField(lines, "Status") || "PENDING";
        const status = rawStatus.toUpperCase().trim();
        const rawMilestones = extractField(lines, "Milestones");
        const milestones = rawMilestones ? rawMilestones.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const reviewState = extractField(lines, "Review") || "draft";
        const rawRef = extractField(lines, "Ref");
        let ref;
        if (rawRef) {
          ref = {};
          const urlMatch = rawRef.match(/url=(\S+)/);
          const pathMatch = rawRef.match(/path=(\S+)/);
          if (urlMatch) ref.url = urlMatch[1];
          if (pathMatch) ref.path = pathMatch[1];
        }
        const decl = { id, title: title.trim(), statement, status, milestones, reviewState };
        if (ref) decl.ref = ref;
        declarations.push(decl);
      }
      return declarations;
    }
    function writeFutureFile(declarations, projectName) {
      const lines = [`# Future: ${projectName}`, ""];
      for (const d of declarations) {
        lines.push(`## ${d.id}: ${d.title}`);
        lines.push(`**Statement:** ${d.statement}`);
        lines.push(`**Status:** ${d.status}`);
        lines.push(`**Review:** ${d.reviewState || "draft"}`);
        lines.push(`**Milestones:** ${d.milestones.join(", ")}`);
        if (d.ref && (d.ref.url || d.ref.path)) {
          const parts = [];
          if (d.ref.url) parts.push(`url=${d.ref.url}`);
          if (d.ref.path) parts.push(`path=${d.ref.path}`);
          lines.push(`**Ref:** ${parts.join(" ")}`);
        }
        lines.push("");
      }
      return lines.join("\n");
    }
    function parseFutureArchive(content) {
      if (!content || !content.trim()) return [];
      const entries = [];
      const sections = content.split(/^## /m).slice(1);
      for (const section of sections) {
        const lines = section.trim().split("\n");
        const headerMatch = lines[0].match(/^Archived:\s*(D-\d+)\s*--\s*(.+)/);
        if (!headerMatch) continue;
        const [, id, title] = headerMatch;
        const statement = extractField(lines, "Statement") || "";
        const archivedAt = extractField(lines, "Archived") || "";
        const reason = extractField(lines, "Reason") || "";
        const replacedBy = extractField(lines, "Replaced By") || "";
        const statusAtArchive = extractField(lines, "Status at Archive") || "";
        entries.push({ id, title: title.trim(), statement, archivedAt, reason, replacedBy, statusAtArchive });
      }
      return entries;
    }
    function writeFutureArchive(entries) {
      const lines = ["# Future Archive", ""];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (i > 0) lines.push("---", "");
        lines.push(`## Archived: ${e.id} -- ${e.title}`);
        lines.push(`**Statement:** ${e.statement}`);
        lines.push(`**Archived:** ${e.archivedAt}`);
        lines.push(`**Reason:** ${e.reason}`);
        lines.push(`**Replaced By:** ${e.replacedBy}`);
        lines.push(`**Status at Archive:** ${e.statusAtArchive}`);
        lines.push("");
      }
      return lines.join("\n");
    }
    function appendToArchive(existingContent, entry) {
      const entries = parseFutureArchive(existingContent || "");
      entries.push(entry);
      return writeFutureArchive(entries);
    }
    module2.exports = { parseFutureFile, writeFutureFile, parseFutureArchive, writeFutureArchive, appendToArchive };
  }
});

// src/artifacts/milestones.js
var require_milestones = __commonJS({
  "src/artifacts/milestones.js"(exports2, module2) {
    "use strict";
    function parseMarkdownTable(text) {
      const lines = text.trim().split("\n").filter((l) => l.trim().startsWith("|"));
      if (lines.length < 2) return [];
      const headers = lines[0].split("|").map((h) => h.trim()).filter(Boolean);
      return lines.slice(2).map((line) => {
        const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
        const row = {};
        headers.forEach((h, i) => {
          row[h] = cells[i] || "";
        });
        return row;
      });
    }
    function splitMultiValue(value) {
      if (!value || !value.trim()) return [];
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
    function parseMilestonesFile(content) {
      if (!content || !content.trim()) {
        return { milestones: [] };
      }
      const milestonesMatch = content.match(/## Milestones\s*\n([\s\S]*?)(?=## |$)/i);
      const milestoneRows = milestonesMatch ? parseMarkdownTable(milestonesMatch[1]) : [];
      const milestones = milestoneRows.map((row) => ({
        id: (row["ID"] || "").trim(),
        title: (row["Title"] || "").trim(),
        description: (row["Description"] || "").trim(),
        status: (row["Status"] || "PENDING").trim().toUpperCase(),
        realizes: splitMultiValue(row["Realizes"] || ""),
        hasPlan: (row["Plan"] || "").trim().toUpperCase() === "YES",
        classification: (row["Classification"] || "agent").trim().toLowerCase() === "human" ? "human" : "agent",
        dependsOn: splitMultiValue(row["Depends On"] || ""),
        reviewState: (row["Review"] || "draft").trim() || "draft"
      })).filter((m) => m.id);
      return { milestones };
    }
    function pad(str, width) {
      return str + " ".repeat(Math.max(0, width - str.length));
    }
    function writeMilestonesFile(milestones, projectNameOrActions, maybeProjectName) {
      const projectName = maybeProjectName || (typeof projectNameOrActions === "string" ? projectNameOrActions : "Project");
      const lines = [`# Milestones: ${projectName}`, ""];
      lines.push("## Milestones", "");
      const hasDescriptions = milestones.some((m) => m.description);
      const hasClassification = milestones.some((m) => m.classification && m.classification !== "agent");
      const hasDependsOn = milestones.some((m) => m.dependsOn && m.dependsOn.length > 0);
      const mHeaders = ["ID", "Title"];
      if (hasDescriptions) mHeaders.push("Description");
      mHeaders.push("Status", "Realizes", "Plan", "Review");
      if (hasClassification) mHeaders.push("Classification");
      if (hasDependsOn) mHeaders.push("Depends On");
      const mRows = milestones.map((m) => {
        const row = [m.id, m.title];
        if (hasDescriptions) row.push(m.description || "");
        row.push(m.status, m.realizes.join(", "), m.hasPlan ? "YES" : "NO", m.reviewState || "draft");
        if (hasClassification) row.push(m.classification || "agent");
        if (hasDependsOn) row.push((m.dependsOn || []).join(", "));
        return row;
      });
      lines.push(...formatTable(mHeaders, mRows));
      lines.push("");
      return lines.join("\n");
    }
    function formatTable(headers, rows) {
      const widths = headers.map((h, i) => {
        const cellWidths = rows.map((r) => (r[i] || "").length);
        return Math.max(h.length, ...cellWidths);
      });
      const headerLine = "| " + headers.map((h, i) => pad(h, widths[i])).join(" | ") + " |";
      const separatorLine = "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|";
      const dataLines = rows.map(
        (row) => "| " + row.map((cell, i) => pad(cell, widths[i])).join(" | ") + " |"
      );
      return [headerLine, separatorLine, ...dataLines];
    }
    module2.exports = { parseMilestonesFile, writeMilestonesFile, parseMarkdownTable };
  }
});

// src/commands/init.js
var require_init = __commonJS({
  "src/commands/init.js"(exports2, module2) {
    "use strict";
    var { existsSync, mkdirSync, writeFileSync, readFileSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { writeFutureFile } = require_future();
    var { writeMilestonesFile } = require_milestones();
    var { commitPlanningDocs: commitPlanningDocs2 } = require_commit();
    function runInit2(cwd, args) {
      const projectName = args && args[0] || basename(cwd);
      const planningDir = join(cwd, ".planning");
      const milestonesDir = join(planningDir, "milestones");
      const artifacts = [
        { name: "FUTURE.md", path: join(planningDir, "FUTURE.md") },
        { name: "MILESTONES.md", path: join(planningDir, "MILESTONES.md") },
        { name: "config.json", path: join(planningDir, "config.json") }
      ];
      const created = [];
      const existing = [];
      if (!existsSync(planningDir)) {
        mkdirSync(planningDir, { recursive: true });
      }
      if (!existsSync(milestonesDir)) {
        mkdirSync(milestonesDir, { recursive: true });
      }
      for (const artifact of artifacts) {
        if (existsSync(artifact.path)) {
          existing.push(artifact.name);
        } else {
          let content;
          switch (artifact.name) {
            case "FUTURE.md":
              content = writeFutureFile([], projectName);
              break;
            case "MILESTONES.md":
              content = writeMilestonesFile([], projectName);
              break;
            case "config.json":
              content = JSON.stringify({ commit_docs: true }, null, 2) + "\n";
              break;
          }
          writeFileSync(artifact.path, content, "utf-8");
          created.push(artifact.name);
        }
      }
      if (created.length === 0) {
        return {
          initialized: true,
          created,
          existing,
          committed: false
        };
      }
      const filesToCommit = created.map((name) => join(".planning", name));
      const commitResult = commitPlanningDocs2(
        cwd,
        `docs(declare): initialize project "${projectName}"`,
        filesToCommit
      );
      return {
        initialized: true,
        created,
        existing,
        committed: commitResult.committed,
        hash: commitResult.hash
      };
    }
    module2.exports = { runInit: runInit2 };
  }
});

// src/artifacts/plan.js
var require_plan = __commonJS({
  "src/artifacts/plan.js"(exports2, module2) {
    "use strict";
    function extractField(lines, field) {
      const pattern = new RegExp(`^\\*\\*${field}:\\*\\*`, "i");
      const line = lines.find((l) => pattern.test(l.trim()));
      if (!line) return null;
      return line.trim().replace(/^\*\*[^:]+:\*\*\s*/, "").trim();
    }
    function parsePlanFile(content) {
      if (!content || !content.trim()) {
        return { milestone: null, realizes: [], status: "PENDING", derived: "", produces: "", actions: [] };
      }
      const headerMatch = content.match(/^# Plan:\s*(M-\d+)/m);
      const milestone = headerMatch ? headerMatch[1] : null;
      const headerSection = content.split(/^## /m)[0] || "";
      const headerLines = headerSection.split("\n");
      const realizesRaw = extractField(headerLines, "Realizes");
      const realizes = realizesRaw ? realizesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const status = (extractField(headerLines, "Status") || "PENDING").toUpperCase();
      const derived = extractField(headerLines, "Derived") || "";
      const produces = extractField(headerLines, "Produces") || "";
      const actionSections = content.split(/^### /m).slice(1);
      const actions = actionSections.map((section) => {
        const lines = section.trim().split("\n");
        const actionHeaderMatch = lines[0].match(/^(A-\d+):\s*(.+)/);
        if (!actionHeaderMatch) return null;
        const [, id, title] = actionHeaderMatch;
        const actionStatus = (extractField(lines, "Status") || "PENDING").toUpperCase();
        const produces2 = extractField(lines, "Produces") || "";
        const reviewState = extractField(lines, "Review") || "draft";
        const description = lines.slice(1).filter((l) => !l.trim().startsWith("**")).map((l) => l.trim()).filter(Boolean).join("\n");
        return { id, title: title.trim(), status: actionStatus, produces: produces2, description, reviewState };
      }).filter(Boolean);
      return { milestone, realizes, status, derived, produces, actions };
    }
    function writePlanFile(milestoneId, milestoneTitle, realizes, actions, options) {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const milestoneProduces = options && options.produces || "";
      const lines = [
        `# Plan: ${milestoneId} -- ${milestoneTitle}`,
        "",
        `**Milestone:** ${milestoneId}`,
        `**Realizes:** ${realizes.join(", ")}`,
        `**Status:** PENDING`,
        `**Derived:** ${today}`
      ];
      if (milestoneProduces) {
        lines.push(`**Produces:** ${milestoneProduces}`);
      }
      lines.push("", "## Actions", "");
      for (const action of actions) {
        const id = action.id || "A-XX";
        const status = action.status || "PENDING";
        const produces = action.produces || "";
        lines.push(`### ${id}: ${action.title}`);
        lines.push(`**Status:** ${status}`);
        lines.push(`**Review:** ${action.reviewState || "draft"}`);
        if (produces) {
          lines.push(`**Produces:** ${produces}`);
        }
        if (action.description) {
          lines.push(action.description);
        }
        lines.push("");
      }
      return lines.join("\n");
    }
    function updateActionStatus(content, actionId, newStatus) {
      const lines = content.split("\n");
      let inSection = false;
      let patched = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith("### ")) {
          inSection = line.startsWith(`### ${actionId}:`);
          if (!inSection) patched = false;
        }
        if (inSection && !patched && /^\*\*Status:\*\*/i.test(line.trim())) {
          lines[i] = `**Status:** ${newStatus}`;
          patched = true;
        }
      }
      return lines.join("\n");
    }
    module2.exports = { parsePlanFile, writePlanFile, updateActionStatus };
  }
});

// src/artifacts/milestone-folders.js
var require_milestone_folders = __commonJS({
  "src/artifacts/milestone-folders.js"(exports2, module2) {
    "use strict";
    var { existsSync, mkdirSync, readdirSync, renameSync } = require("node:fs");
    var { join, basename } = require("node:path");
    function slugify(title) {
      return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    function milestoneFolderName(id, title) {
      return `${id}-${slugify(title)}`;
    }
    function getMilestoneFolderPath(planningDir, id, title) {
      return join(planningDir, "milestones", milestoneFolderName(id, title));
    }
    function ensureMilestoneFolder(planningDir, id, title) {
      const folderPath = getMilestoneFolderPath(planningDir, id, title);
      if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
      }
      return folderPath;
    }
    function findMilestoneFolder(planningDir, id) {
      const milestonesDir = join(planningDir, "milestones");
      if (!existsSync(milestonesDir)) return null;
      const entries = readdirSync(milestonesDir, { withFileTypes: true });
      const folder = entries.find((e) => e.isDirectory() && e.name.startsWith(id));
      return folder ? join(milestonesDir, folder.name) : null;
    }
    function archiveMilestoneFolder(planningDir, id) {
      const folder = findMilestoneFolder(planningDir, id);
      if (!folder) return false;
      const archiveDir = join(planningDir, "milestones", "_archived");
      mkdirSync(archiveDir, { recursive: true });
      renameSync(folder, join(archiveDir, basename(folder)));
      return true;
    }
    module2.exports = {
      slugify,
      milestoneFolderName,
      getMilestoneFolderPath,
      ensureMilestoneFolder,
      findMilestoneFolder,
      archiveMilestoneFolder
    };
  }
});

// src/graph/engine.js
var require_engine = __commonJS({
  "src/graph/engine.js"(exports2, module2) {
    "use strict";
    var PREFIX_TO_TYPE = { D: "declaration", M: "milestone", A: "action" };
    var TYPE_TO_PREFIX = { declaration: "D", milestone: "M", action: "A" };
    var VALID_STATUSES = /* @__PURE__ */ new Set(["PENDING", "ACTIVE", "DONE", "KEPT", "BROKEN", "HONORED", "RENEGOTIATED"]);
    var COMPLETED_STATUSES = /* @__PURE__ */ new Set(["DONE", "KEPT", "HONORED", "RENEGOTIATED"]);
    function isCompleted(status) {
      return COMPLETED_STATUSES.has(status);
    }
    var VALID_TYPES = /* @__PURE__ */ new Set(["declaration", "milestone", "action"]);
    var VALID_REVIEW_STATES = /* @__PURE__ */ new Set(["draft", "in_review", "revision_needed", "approved"]);
    var VALID_EDGE_DIRECTIONS = {
      action: "milestone",
      milestone: "declaration"
    };
    var DeclareDag = class _DeclareDag {
      constructor() {
        this.nodes = /* @__PURE__ */ new Map();
        this.upEdges = /* @__PURE__ */ new Map();
        this.downEdges = /* @__PURE__ */ new Map();
      }
      // ---------------------------------------------------------------------------
      // Node operations
      // ---------------------------------------------------------------------------
      /**
       * Add a node to the graph.
       * @param {string} id - Semantic ID (D-XX, M-XX, A-XX)
       * @param {string} type - 'declaration' | 'milestone' | 'action'
       * @param {string} title - Human-readable title
       * @param {string} [status='PENDING'] - PENDING | ACTIVE | DONE
       * @param {Record<string, any>} [metadata={}] - Additional metadata
       * @returns {DeclareDag} this (for chaining)
       */
      addNode(id, type, title, status = "PENDING", metadata = {}) {
        if (!VALID_TYPES.has(type)) {
          throw new Error(`Invalid node type: ${type}. Must be one of: declaration, milestone, action`);
        }
        if (!VALID_STATUSES.has(status)) {
          throw new Error(`Invalid status: ${status}. Must be one of: PENDING, ACTIVE, DONE`);
        }
        const prefix = id.split("-")[0];
        if (PREFIX_TO_TYPE[prefix] !== type) {
          throw new Error(
            `ID prefix '${prefix}' doesn't match type '${type}'. Expected prefix '${TYPE_TO_PREFIX[type]}' for type '${type}'`
          );
        }
        if (!/^[DMA]-\d+$/.test(id)) {
          throw new Error(`Invalid ID format: ${id}. Expected format: D-01, M-01, A-01`);
        }
        if (this.nodes.has(id)) {
          throw new Error(`Node already exists: ${id}`);
        }
        this.nodes.set(id, { id, type, title, status, metadata });
        if (!this.upEdges.has(id)) this.upEdges.set(id, /* @__PURE__ */ new Set());
        if (!this.downEdges.has(id)) this.downEdges.set(id, /* @__PURE__ */ new Set());
        return this;
      }
      /**
       * Remove a node and all its edges.
       * @param {string} id
       * @returns {DeclareDag} this
       */
      removeNode(id) {
        if (!this.nodes.has(id)) {
          throw new Error(`Node not found: ${id}`);
        }
        const upTargets = this.upEdges.get(id);
        if (upTargets) {
          for (const target of upTargets) {
            const downSet = this.downEdges.get(target);
            if (downSet) downSet.delete(id);
          }
        }
        const downSources = this.downEdges.get(id);
        if (downSources) {
          for (const source of downSources) {
            const upSet = this.upEdges.get(source);
            if (upSet) upSet.delete(id);
          }
        }
        this.upEdges.delete(id);
        this.downEdges.delete(id);
        this.nodes.delete(id);
        return this;
      }
      /**
       * Get a node by ID.
       * @param {string} id
       * @returns {{id: string, type: string, title: string, status: string, metadata: Record<string, any>} | undefined}
       */
      getNode(id) {
        return this.nodes.get(id);
      }
      /**
       * Update a node's status.
       * @param {string} id
       * @param {string} status - PENDING | ACTIVE | DONE
       * @returns {DeclareDag} this
       */
      updateNodeStatus(id, status) {
        if (!VALID_STATUSES.has(status)) {
          throw new Error(`Invalid status: ${status}. Must be one of: PENDING, ACTIVE, DONE`);
        }
        const node = this.nodes.get(id);
        if (!node) {
          throw new Error(`Node not found: ${id}`);
        }
        node.status = status;
        return this;
      }
      // ---------------------------------------------------------------------------
      // Edge operations
      // ---------------------------------------------------------------------------
      /**
       * Add an upward-causation edge.
       * Valid directions: action->milestone, milestone->declaration.
       * @param {string} from - Source node ID
       * @param {string} to - Target node ID
       * @returns {DeclareDag} this
       */
      addEdge(from, to) {
        const fromNode = this.nodes.get(from);
        const toNode = this.nodes.get(to);
        if (!fromNode) throw new Error(`Node not found: ${from}`);
        if (!toNode) throw new Error(`Node not found: ${to}`);
        const expectedTo = VALID_EDGE_DIRECTIONS[fromNode.type];
        if (expectedTo !== toNode.type) {
          throw new Error(
            `Invalid edge: ${fromNode.type} -> ${toNode.type}. Only action->milestone and milestone->declaration edges are allowed`
          );
        }
        this.upEdges.get(from).add(to);
        this.downEdges.get(to).add(from);
        return this;
      }
      /**
       * Remove an edge.
       * @param {string} from
       * @param {string} to
       * @returns {DeclareDag} this
       */
      removeEdge(from, to) {
        const upSet = this.upEdges.get(from);
        if (upSet) upSet.delete(to);
        const downSet = this.downEdges.get(to);
        if (downSet) downSet.delete(from);
        return this;
      }
      // ---------------------------------------------------------------------------
      // Layer queries
      // ---------------------------------------------------------------------------
      /** @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
      getDeclarations() {
        return this._byType("declaration");
      }
      /** @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
      getMilestones() {
        return this._byType("milestone");
      }
      /** @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
      getActions() {
        return this._byType("action");
      }
      /**
       * Get nodes that this node causes/realizes (upward neighbors).
       * @param {string} id
       * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
       */
      getUpstream(id) {
        const targets = this.upEdges.get(id);
        if (!targets) return [];
        return [...targets].map((t) => this.nodes.get(t)).filter(Boolean);
      }
      /**
       * Get nodes that cause/realize this node (downward neighbors).
       * @param {string} id
       * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
       */
      getDownstream(id) {
        const sources = this.downEdges.get(id);
        if (!sources) return [];
        return [...sources].map((s) => this.nodes.get(s)).filter(Boolean);
      }
      /**
       * @param {string} type
       * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
       * @private
       */
      _byType(type) {
        return [...this.nodes.values()].filter((n) => n.type === type);
      }
      // ---------------------------------------------------------------------------
      // Validation (runs on /declare:status, NOT on normal operations)
      // ---------------------------------------------------------------------------
      /**
       * Validate graph structure.
       * Checks: orphan nodes, cycles, broken edges, invalid edge directions.
       * @returns {{ valid: boolean, errors: Array<{type: string, node?: string, from?: string, to?: string, message: string}> }}
       */
      validate() {
        const errors = [];
        for (const [id, node] of this.nodes) {
          if (node.type === "declaration") continue;
          if (this.upEdges.get(id).size === 0) {
            errors.push({
              type: "orphan",
              node: id,
              message: `${id} has no upward connection`
            });
          }
        }
        if (this._hasCycle()) {
          errors.push({
            type: "cycle",
            message: "Graph contains a cycle"
          });
        }
        for (const [from, targets] of this.upEdges) {
          for (const to of targets) {
            if (!this.nodes.has(to)) {
              errors.push({
                type: "broken_edge",
                from,
                to,
                message: `Edge target ${to} not found`
              });
            }
          }
        }
        return { valid: errors.length === 0, errors };
      }
      // ---------------------------------------------------------------------------
      // Topological sort
      // ---------------------------------------------------------------------------
      /**
       * Kahn's algorithm topological sort.
       * Returns node IDs in execution order: actions first, then milestones, then declarations.
       * @returns {string[]}
       * @throws {Error} If cycle detected
       */
      topologicalSort() {
        const inDegree = /* @__PURE__ */ new Map();
        const adjList = /* @__PURE__ */ new Map();
        for (const id of this.nodes.keys()) {
          inDegree.set(id, 0);
          adjList.set(id, /* @__PURE__ */ new Set());
        }
        for (const [from, targets] of this.upEdges) {
          for (const to of targets) {
            if (!this.nodes.has(to)) continue;
            adjList.get(from).add(to);
            inDegree.set(to, (inDegree.get(to) || 0) + 1);
          }
        }
        const queue = [];
        for (const [id, deg] of inDegree) {
          if (deg === 0) queue.push(id);
        }
        const sorted = [];
        while (queue.length > 0) {
          const node = queue.shift();
          sorted.push(node);
          for (const neighbor of adjList.get(node)) {
            inDegree.set(neighbor, inDegree.get(neighbor) - 1);
            if (inDegree.get(neighbor) === 0) queue.push(neighbor);
          }
        }
        if (sorted.length !== this.nodes.size) {
          throw new Error("Cycle detected: topological sort incomplete");
        }
        return sorted;
      }
      /**
       * Check if graph has a cycle.
       * @returns {boolean}
       * @private
       */
      _hasCycle() {
        try {
          this.topologicalSort();
          return false;
        } catch {
          return true;
        }
      }
      // ---------------------------------------------------------------------------
      // Serialization
      // ---------------------------------------------------------------------------
      /**
       * Serialize graph to JSON-compatible object.
       * @returns {{ nodes: Array, edges: Array<{from: string, to: string}> }}
       */
      toJSON() {
        return {
          nodes: [...this.nodes.values()].map((n) => ({ ...n })),
          edges: [...this.upEdges.entries()].flatMap(
            ([from, tos]) => [...tos].map((to) => ({ from, to }))
          )
        };
      }
      /**
       * Reconstruct DeclareDag from JSON.
       * @param {{ nodes: Array, edges: Array<{from: string, to: string}> }} data
       * @returns {DeclareDag}
       */
      static fromJSON(data) {
        const dag = new _DeclareDag();
        for (const node of data.nodes) {
          dag.addNode(node.id, node.type, node.title, node.status, node.metadata || {});
        }
        for (const edge of data.edges) {
          dag.addEdge(edge.from, edge.to);
        }
        return dag;
      }
      // ---------------------------------------------------------------------------
      // Auto-increment helper
      // ---------------------------------------------------------------------------
      /**
       * Get the next available ID for a given type.
       * Scans existing nodes, finds max numeric suffix, returns next ID.
       * @param {string} type - 'declaration' | 'milestone' | 'action'
       * @returns {string} Next ID (e.g., 'D-03' if D-01, D-02 exist)
       */
      nextId(type) {
        if (!VALID_TYPES.has(type)) {
          throw new Error(`Invalid type: ${type}`);
        }
        const prefix = TYPE_TO_PREFIX[type];
        let max = 0;
        for (const [id, node] of this.nodes) {
          if (node.type === type) {
            const num = parseInt(id.split("-")[1], 10);
            if (num > max) max = num;
          }
        }
        const next = max + 1;
        const padded = next < 10 ? `0${next}` : `${next}`;
        return `${prefix}-${padded}`;
      }
      // ---------------------------------------------------------------------------
      // Node counts
      // ---------------------------------------------------------------------------
      /** @returns {number} Total node count */
      get size() {
        return this.nodes.size;
      }
      // ---------------------------------------------------------------------------
      // Wholeness computation (bottom-up integrity model)
      // ---------------------------------------------------------------------------
      /**
       * Compute wholeness state for every node in the graph.
       *
       * Bottom-up, three-pass computation:
       *   1. Actions: whole if isCompleted(status), broken otherwise
       *   2. Milestones: whole if ALL child actions whole, partial if SOME, broken if NONE (or no children)
       *   3. Declarations: whole if ALL child milestones whole, partial if SOME, broken if NONE (or no children)
       *
       * Milestone wholeness is computed from action completion, NOT from the milestone's own status field.
       * Declaration wholeness is computed from milestone wholeness results.
       *
       * @returns {Map<string, string>} Map of node ID to wholeness state ("whole" | "partial" | "broken")
       */
      computeWholeness() {
        const wholeness = /* @__PURE__ */ new Map();
        for (const [id, node] of this.nodes) {
          if (node.type === "action") {
            wholeness.set(id, isCompleted(node.status) ? "whole" : "broken");
          }
        }
        for (const [id, node] of this.nodes) {
          if (node.type === "milestone") {
            const children = this.downEdges.get(id);
            if (!children || children.size === 0) {
              wholeness.set(id, "broken");
              continue;
            }
            let wholeCount = 0;
            for (const childId of children) {
              if (wholeness.get(childId) === "whole") wholeCount++;
            }
            if (wholeCount === children.size) {
              wholeness.set(id, "whole");
            } else if (wholeCount > 0) {
              wholeness.set(id, "partial");
            } else {
              wholeness.set(id, "broken");
            }
          }
        }
        for (const [id, node] of this.nodes) {
          if (node.type === "declaration") {
            const children = this.downEdges.get(id);
            if (!children || children.size === 0) {
              wholeness.set(id, "broken");
              continue;
            }
            let wholeCount = 0;
            for (const childId of children) {
              if (wholeness.get(childId) === "whole") wholeCount++;
            }
            if (wholeCount === children.size) {
              wholeness.set(id, "whole");
            } else if (wholeCount > 0) {
              wholeness.set(id, "partial");
            } else {
              wholeness.set(id, "broken");
            }
          }
        }
        return wholeness;
      }
      /**
       * Get graph statistics.
       * @returns {{ declarations: number, milestones: number, actions: number, edges: number, byStatus: {PENDING: number, ACTIVE: number, DONE: number} }}
       */
      stats() {
        const byStatus = {};
        for (const s of VALID_STATUSES) byStatus[s] = 0;
        let declarations = 0;
        let milestones = 0;
        let actions = 0;
        let edges = 0;
        for (const node of this.nodes.values()) {
          byStatus[node.status]++;
          if (node.type === "declaration") declarations++;
          else if (node.type === "milestone") milestones++;
          else if (node.type === "action") actions++;
        }
        for (const targets of this.upEdges.values()) {
          edges += targets.size;
        }
        return { declarations, milestones, actions, edges, byStatus };
      }
    };
    function findOrphans(dag) {
      const { errors } = dag.validate();
      return errors.filter((e) => e.type === "orphan" && e.node).map((e) => {
        const node = dag.getNode(e.node);
        return node ? { id: node.id, type: node.type, title: node.title, status: node.status } : { id: e.node, type: "unknown", title: "", status: "" };
      });
    }
    function computeWholeness(dag) {
      return dag.computeWholeness();
    }
    function computeWorkabilityPath(dag, nodeId) {
      if (!dag.getNode(nodeId)) {
        throw new Error(`Node not found: ${nodeId}`);
      }
      const wholenessMap = dag.computeWholeness();
      const nodeWholeness = wholenessMap.get(nodeId);
      if (nodeWholeness === "whole") {
        return { nodeId, wholeness: "whole", steps: [] };
      }
      const brokenActions = [];
      const visited = /* @__PURE__ */ new Set();
      function walkDown(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const node = dag.getNode(id);
        if (!node) return;
        if (node.type === "action" && wholenessMap.get(id) === "broken") {
          brokenActions.push(node);
          return;
        }
        const children = dag.downEdges.get(id);
        if (!children) return;
        for (const childId of children) {
          if (wholenessMap.get(childId) !== "whole") {
            walkDown(childId);
          }
        }
      }
      walkDown(nodeId);
      const steps = brokenActions.map((action) => {
        const ancestors = /* @__PURE__ */ new Set();
        const ancestorVisited = /* @__PURE__ */ new Set();
        function walkUp(id) {
          if (ancestorVisited.has(id)) return;
          ancestorVisited.add(id);
          const upTargets = dag.upEdges.get(id);
          if (!upTargets) return;
          for (const targetId of upTargets) {
            ancestors.add(targetId);
            walkUp(targetId);
          }
        }
        walkUp(action.id);
        let nonWholeCount = 0;
        for (const ancestorId of ancestors) {
          if (wholenessMap.get(ancestorId) !== "whole") {
            nonWholeCount++;
          }
        }
        let impact;
        if (nonWholeCount >= 3) {
          impact = "high";
        } else if (nonWholeCount >= 1) {
          impact = "medium";
        } else {
          impact = "low";
        }
        const upstream = dag.getUpstream(action.id);
        const milestone = upstream.find((n) => n.type === "milestone");
        const milestoneId = milestone ? milestone.id : "";
        return {
          actionId: action.id,
          title: action.title,
          milestoneId,
          impact
        };
      });
      const impactOrder = { high: 0, medium: 1, low: 2 };
      steps.sort((a, b) => {
        const impactDiff = impactOrder[a.impact] - impactOrder[b.impact];
        if (impactDiff !== 0) return impactDiff;
        return a.actionId.localeCompare(b.actionId);
      });
      return { nodeId, wholeness: nodeWholeness, steps };
    }
    module2.exports = { DeclareDag, VALID_REVIEW_STATES, COMPLETED_STATUSES, isCompleted, findOrphans, computeWholeness, computeWorkabilityPath };
  }
});

// src/commands/build-dag.js
var require_build_dag = __commonJS({
  "src/commands/build-dag.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, readdirSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFutureFile } = require_future();
    var { parseMilestonesFile } = require_milestones();
    var { parsePlanFile } = require_plan();
    var { DeclareDag } = require_engine();
    function loadActionsFromFolders(planningDir) {
      const milestonesDir = join(planningDir, "milestones");
      if (!existsSync(milestonesDir)) return { actions: [], milestoneProduces: {} };
      const allActions = [];
      const milestoneProduces = {};
      const entries = readdirSync(milestonesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
        const planPath = join(milestonesDir, entry.name, "PLAN.md");
        if (!existsSync(planPath)) continue;
        const content = readFileSync(planPath, "utf-8");
        const { milestone, actions, produces } = parsePlanFile(content);
        if (milestone && produces) {
          milestoneProduces[milestone] = produces;
        }
        for (const action of actions) {
          allActions.push({
            id: action.id,
            title: action.title,
            status: action.status,
            produces: action.produces,
            reviewState: action.reviewState || "draft",
            causes: milestone ? [milestone] : []
          });
        }
      }
      return { actions: allActions, milestoneProduces };
    }
    function buildDagFromDisk(cwd) {
      const planningDir = join(cwd, ".planning");
      if (!existsSync(planningDir)) {
        return { error: "No Declare project found. Run /declare:init first." };
      }
      const futurePath = join(planningDir, "FUTURE.md");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones } = parseMilestonesFile(milestonesContent);
      const { actions: allLoadedActions, milestoneProduces } = loadActionsFromFolders(planningDir);
      const milestoneIds = new Set(milestones.map((m) => m.id.toUpperCase()));
      const actions = allLoadedActions.filter(
        (a) => a.causes.some((c) => milestoneIds.has(c.toUpperCase()))
      );
      for (const m of milestones) {
        if (milestoneProduces[m.id]) {
          m.produces = milestoneProduces[m.id];
        }
      }
      const dag = new DeclareDag();
      for (const d of declarations) {
        const meta = { reviewState: d.reviewState || "draft" };
        if (d.ref) meta.ref = d.ref;
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING", meta);
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING", {
          description: m.description || "",
          produces: m.produces || "",
          classification: m.classification || "agent",
          dependsOn: m.dependsOn || [],
          reviewState: m.reviewState || "draft"
        });
      }
      for (const a of actions) {
        dag.addNode(a.id, "action", a.title, a.status || "PENDING", { reviewState: a.reviewState || "draft" });
      }
      for (const m of milestones) {
        for (const declId of m.realizes) {
          if (dag.getNode(declId)) {
            dag.addEdge(m.id, declId);
          }
        }
      }
      for (const a of actions) {
        for (const milestoneId of a.causes) {
          if (dag.getNode(milestoneId)) {
            dag.addEdge(a.id, milestoneId);
          }
        }
      }
      return { dag, declarations, milestones, actions };
    }
    module2.exports = { buildDagFromDisk, loadActionsFromFolders };
  }
});

// src/commands/compute-performance.js
var require_compute_performance = __commonJS({
  "src/commands/compute-performance.js"(exports2, module2) {
    "use strict";
    var { buildDagFromDisk } = require_build_dag();
    var { isCompleted } = require_engine();
    function ratioToLabel(ratio, highThreshold, medThreshold) {
      if (ratio >= highThreshold) return "HIGH";
      if (ratio >= medThreshold) return "MEDIUM";
      return "LOW";
    }
    function combineLabels(alignment, integrity) {
      if (alignment === "LOW" || integrity === "LOW") return "LOW";
      if (alignment === "HIGH" && integrity === "HIGH") return "HIGH";
      return "MEDIUM";
    }
    function runComputePerformance2(cwd) {
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const declarations = dag.getDeclarations();
      if (declarations.length === 0) {
        return {
          perDeclaration: [],
          rollup: { alignment: "HIGH", integrity: "HIGH", performance: "HIGH" }
        };
      }
      const perDeclaration = declarations.map((decl) => {
        const downstream = dag.getDownstream(decl.id);
        const milestones = downstream.filter((n) => n.type === "milestone");
        let milestonesWithActions = 0;
        for (const m of milestones) {
          const mDownstream = dag.getDownstream(m.id);
          if (mDownstream.some((n) => n.type === "action")) {
            milestonesWithActions++;
          }
        }
        const alignmentRatio = milestones.length > 0 ? milestonesWithActions / milestones.length : 0;
        const alignmentLevel = milestones.length === 0 ? "LOW" : ratioToLabel(alignmentRatio, 0.8, 0.5);
        let verified = 0;
        let broken = 0;
        let pending = 0;
        for (const m of milestones) {
          const status = m.status;
          if (status === "KEPT" || status === "HONORED" || status === "RENEGOTIATED") {
            verified++;
          } else if (status === "BROKEN") {
            broken++;
          } else {
            pending++;
          }
        }
        let integrityLevel;
        if (milestones.length === 0) {
          integrityLevel = "HIGH";
        } else {
          const brokenRatio = broken / milestones.length;
          const verifiedRatio = verified / milestones.length;
          if (brokenRatio > 0.3) {
            integrityLevel = "LOW";
          } else if (verifiedRatio >= 0.7 && broken === 0) {
            integrityLevel = "HIGH";
          } else if (verifiedRatio >= 0.4) {
            integrityLevel = "MEDIUM";
          } else {
            integrityLevel = "LOW";
          }
        }
        const performance = combineLabels(alignmentLevel, integrityLevel);
        return {
          declarationId: decl.id,
          declarationTitle: decl.title,
          statement: decl.metadata?.statement || decl.title,
          alignment: {
            level: alignmentLevel,
            milestonesTotal: milestones.length,
            milestonesWithActions
          },
          integrity: {
            level: integrityLevel,
            verified,
            broken,
            pending,
            total: milestones.length
          },
          performance
        };
      });
      const hasAnyLowAlignment = perDeclaration.some((d) => d.alignment.level === "LOW");
      const hasAnyLowIntegrity = perDeclaration.some((d) => d.integrity.level === "LOW");
      const allHighAlignment = perDeclaration.every((d) => d.alignment.level === "HIGH");
      const allHighIntegrity = perDeclaration.every((d) => d.integrity.level === "HIGH");
      const rollupAlignment = hasAnyLowAlignment ? "LOW" : allHighAlignment ? "HIGH" : "MEDIUM";
      const rollupIntegrity = hasAnyLowIntegrity ? "LOW" : allHighIntegrity ? "HIGH" : "MEDIUM";
      const rollupPerformance = combineLabels(rollupAlignment, rollupIntegrity);
      return {
        perDeclaration,
        rollup: {
          alignment: rollupAlignment,
          integrity: rollupIntegrity,
          performance: rollupPerformance
        }
      };
    }
    module2.exports = { runComputePerformance: runComputePerformance2 };
  }
});

// src/commands/status.js
var require_status = __commonJS({
  "src/commands/status.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { execFileSync } = require("node:child_process");
    var { parsePlanFile } = require_plan();
    var { findMilestoneFolder } = require_milestone_folders();
    var { buildDagFromDisk } = require_build_dag();
    var { isCompleted } = require_engine();
    var { runComputePerformance: runComputePerformance2 } = require_compute_performance();
    function detectStaleness(cwd, planningDir, milestones) {
      const indicators = [];
      for (const m of milestones) {
        const folder = findMilestoneFolder(planningDir, m.id);
        if (!folder) {
          indicators.push({ milestone: m.id, issue: "NO_PLAN", detail: "No plan derived yet" });
          continue;
        }
        const planPath = join(folder, "PLAN.md");
        if (!existsSync(planPath)) {
          indicators.push({ milestone: m.id, issue: "EMPTY_FOLDER", detail: "Folder exists but no PLAN.md" });
          continue;
        }
        try {
          const lastMod = execFileSync("git", ["log", "-1", "--format=%ct", "--", planPath], {
            cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"]
          }).trim();
          if (lastMod) {
            const ageDays = (Date.now() - parseInt(lastMod, 10) * 1e3) / 864e5;
            if (ageDays > 30) {
              indicators.push({ milestone: m.id, issue: "STALE", detail: `Plan not updated in ${Math.floor(ageDays)} days` });
            }
          }
        } catch {
        }
        const plan = parsePlanFile(readFileSync(planPath, "utf-8"));
        if (m.status === "ACTIVE" && plan.actions.length > 0 && plan.actions.every((a) => isCompleted(a.status))) {
          indicators.push({ milestone: m.id, issue: "COMPLETABLE", detail: "All actions done, milestone still ACTIVE" });
        }
        if (isCompleted(m.status) && plan.actions.some((a) => !isCompleted(a.status))) {
          indicators.push({ milestone: m.id, issue: "INCONSISTENT", detail: "Milestone marked completed but has incomplete actions" });
        }
      }
      return indicators;
    }
    function runStatus2(cwd) {
      const planningDir = join(cwd, ".planning");
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag, declarations, milestones, actions } = graphResult;
      const projectName = basename(cwd);
      const validation = dag.validate();
      const stats = dag.stats();
      let lastActivity = "No activity recorded";
      try {
        const output = execFileSync("git", ["log", "-1", "--format=%ci %s", "--", ".planning/"], {
          cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"]
        }).trim();
        if (output) {
          lastActivity = output;
        }
      } catch {
      }
      const withPlan = milestones.filter((m) => m.hasPlan).length;
      const coverage = {
        total: milestones.length,
        withPlan,
        percentage: milestones.length > 0 ? Math.round(withPlan / milestones.length * 100) : 100
      };
      const staleness = detectStaleness(cwd, planningDir, milestones);
      const integrity = {
        total: milestones.length,
        verified: 0,
        // KEPT + HONORED + RENEGOTIATED
        kept: 0,
        honored: 0,
        renegotiated: 0,
        broken: 0,
        pending: 0
        // PENDING + ACTIVE + DONE (not yet verified)
      };
      for (const m of milestones) {
        switch (m.status) {
          case "KEPT":
            integrity.kept++;
            integrity.verified++;
            break;
          case "HONORED":
            integrity.honored++;
            integrity.verified++;
            break;
          case "RENEGOTIATED":
            integrity.renegotiated++;
            integrity.verified++;
            break;
          case "BROKEN":
            integrity.broken++;
            break;
          default:
            integrity.pending++;
            break;
        }
      }
      let health = "healthy";
      if (!validation.valid) {
        const hasCycle = validation.errors.some((e) => e.type === "cycle");
        const hasBroken = validation.errors.some((e) => e.type === "broken_edge");
        health = hasCycle || hasBroken ? "errors" : "warnings";
      }
      if (staleness.length > 0 && health === "healthy") {
        health = "warnings";
      }
      if (integrity.broken > 0 && health === "healthy") {
        health = "warnings";
      }
      let performance = null;
      try {
        const perfResult = runComputePerformance2(cwd);
        if (!perfResult.error) {
          performance = {
            perDeclaration: perfResult.perDeclaration.map((d) => ({
              declarationId: d.declarationId,
              declarationTitle: d.declarationTitle,
              alignment: d.alignment.level,
              integrity: d.integrity.level,
              performance: d.performance
            })),
            rollup: perfResult.rollup
          };
        }
      } catch {
      }
      return {
        project: projectName,
        stats: {
          declarations: stats.declarations,
          milestones: stats.milestones,
          actions: stats.actions,
          edges: stats.edges,
          byStatus: stats.byStatus
        },
        validation: {
          valid: validation.valid,
          errors: validation.errors
        },
        lastActivity,
        health,
        coverage,
        staleness,
        integrity,
        performance
      };
    }
    module2.exports = { runStatus: runStatus2 };
  }
});

// src/commands/help.js
var require_help = __commonJS({
  "src/commands/help.js"(exports2, module2) {
    "use strict";
    function runHelp2() {
      return {
        commands: [
          {
            name: "/declare:init",
            description: "Initialize a Declare project with future declarations and graph structure",
            usage: "/declare:init [project-name]"
          },
          {
            name: "/declare:status",
            description: "Show graph state, coverage, staleness indicators, and last activity",
            usage: "/declare:status"
          },
          {
            name: "add-declaration",
            description: "Add a new declaration to FUTURE.md with auto-incremented ID",
            usage: 'add-declaration --title "..." --statement "..."'
          },
          {
            name: "add-milestone",
            description: "Add a new milestone to MILESTONES.md linked to declarations",
            usage: 'add-milestone --title "..." --realizes D-01[,D-02]'
          },
          {
            name: "create-plan",
            description: "Write action plan (PLAN.md) to milestone folder",
            usage: `create-plan --milestone M-XX --actions '[{"title":"...","produces":"..."}]'`
          },
          {
            name: "load-graph",
            description: "Load full graph state as JSON with stats and validation",
            usage: "load-graph"
          },
          {
            name: "/declare:milestones",
            description: "Derive milestones backward from declared futures with checkbox confirmation",
            usage: "/declare:milestones [D-XX]"
          },
          {
            name: "/declare:actions",
            description: "Derive action plans per milestone and write PLAN.md to milestone folders",
            usage: "/declare:actions [M-XX]"
          },
          {
            name: "/declare:help",
            description: "Show available Declare commands",
            usage: "/declare:help"
          }
        ],
        version: "1.0.5"
      };
    }
    module2.exports = { runHelp: runHelp2 };
  }
});

// src/commands/parse-args.js
var require_parse_args = __commonJS({
  "src/commands/parse-args.js"(exports2, module2) {
    "use strict";
    function parseFlag(args, flag) {
      const flagStr = `--${flag}`;
      const idx = args.indexOf(flagStr);
      if (idx === -1 || idx + 1 >= args.length) return null;
      return args[idx + 1];
    }
    module2.exports = { parseFlag };
  }
});

// src/commands/add-declaration.js
var require_add_declaration = __commonJS({
  "src/commands/add-declaration.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFutureFile, writeFutureFile } = require_future();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runAddDeclaration2(cwd, args) {
      const title = parseFlag(args, "title");
      const statement = parseFlag(args, "statement");
      if (!title) {
        return { error: "Missing required flag: --title" };
      }
      if (!statement) {
        return { error: "Missing required flag: --statement" };
      }
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      const projectName = basename(cwd);
      if (!existsSync(planningDir)) {
        mkdirSync(planningDir, { recursive: true });
      }
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      const id = dag.nextId("declaration");
      declarations.push({
        id,
        title,
        statement,
        status: "PENDING",
        milestones: []
      });
      const content = writeFutureFile(declarations, projectName);
      writeFileSync(futurePath, content, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: add ${id} "${title}"`,
          [".planning/FUTURE.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { id, title, statement, status: "PENDING", committed, hash };
    }
    module2.exports = { runAddDeclaration: runAddDeclaration2 };
  }
});

// src/commands/update-declaration.js
var require_update_declaration = __commonJS({
  "src/commands/update-declaration.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFutureFile, writeFutureFile } = require_future();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runUpdateDeclaration2(cwd, args) {
      const id = parseFlag(args, "id");
      const title = parseFlag(args, "title");
      const statement = parseFlag(args, "statement");
      const status = parseFlag(args, "status");
      if (!id) {
        return { error: "Missing required flag: --id" };
      }
      if (!title && !statement && !status) {
        return { error: "At least one of --title, --statement, or --status must be provided" };
      }
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      if (!existsSync(futurePath)) {
        return { error: "FUTURE.md not found" };
      }
      const futureContent = readFileSync(futurePath, "utf-8");
      const declarations = parseFutureFile(futureContent);
      const decl = declarations.find((d) => d.id === id);
      if (!decl) {
        return { error: `Declaration not found: ${id}` };
      }
      if (title) decl.title = title;
      if (statement) decl.statement = statement;
      if (status) decl.status = status.toUpperCase();
      const headerMatch = futureContent.match(/^# Future: (.+)/m);
      const projectName = headerMatch ? headerMatch[1].trim() : "Project";
      const content = writeFutureFile(declarations, projectName);
      writeFileSync(futurePath, content, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: update ${id} "${decl.title}"`,
          [".planning/FUTURE.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { id, title: decl.title, statement: decl.statement, status: decl.status, committed, hash };
    }
    module2.exports = { runUpdateDeclaration: runUpdateDeclaration2 };
  }
});

// src/commands/delete-declaration.js
var require_delete_declaration = __commonJS({
  "src/commands/delete-declaration.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFutureFile, writeFutureFile } = require_future();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runDeleteDeclaration2(cwd, args) {
      const id = parseFlag(args, "id");
      if (!id) {
        return { error: "Missing required flag: --id" };
      }
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      if (!existsSync(futurePath)) {
        return { error: "FUTURE.md not found" };
      }
      const futureContent = readFileSync(futurePath, "utf-8");
      const declarations = parseFutureFile(futureContent);
      const decl = declarations.find((d) => d.id === id);
      if (!decl) {
        return { error: `Declaration not found: ${id}` };
      }
      if (decl.milestones && decl.milestones.length > 0) {
        return { error: "Cannot delete declaration with linked milestones. Renegotiate instead." };
      }
      const filtered = declarations.filter((d) => d.id !== id);
      const headerMatch = futureContent.match(/^# Future: (.+)/m);
      const projectName = headerMatch ? headerMatch[1].trim() : "Project";
      const content = writeFutureFile(filtered, projectName);
      writeFileSync(futurePath, content, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: delete ${id} "${decl.title}"`,
          [".planning/FUTURE.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { id, title: decl.title, deleted: true, committed, hash };
    }
    module2.exports = { runDeleteDeclaration: runDeleteDeclaration2 };
  }
});

// src/commands/add-milestone.js
var require_add_milestone = __commonJS({
  "src/commands/add-milestone.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFutureFile, writeFutureFile } = require_future();
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runAddMilestone2(cwd, args) {
      const title = parseFlag(args, "title");
      const realizesRaw = parseFlag(args, "realizes");
      if (!title) {
        return { error: "Missing required flag: --title" };
      }
      if (!realizesRaw) {
        return { error: "Missing required flag: --realizes" };
      }
      const realizes = realizesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const projectName = basename(cwd);
      if (!existsSync(planningDir)) {
        mkdirSync(planningDir, { recursive: true });
      }
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones } = parseMilestonesFile(milestonesContent);
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
      }
      for (const declId of realizes) {
        if (!dag.getNode(declId)) {
          return { error: `Declaration not found: ${declId}` };
        }
      }
      const id = dag.nextId("milestone");
      milestones.push({
        id,
        title,
        status: "PENDING",
        realizes,
        hasPlan: false
      });
      for (const declId of realizes) {
        const decl = declarations.find((d) => d.id === declId);
        if (decl && !decl.milestones.includes(id)) {
          decl.milestones.push(id);
        }
      }
      const futureOutput = writeFutureFile(declarations, projectName);
      writeFileSync(futurePath, futureOutput, "utf-8");
      const milestonesOutput = writeMilestonesFile(milestones, projectName);
      writeFileSync(milestonesPath, milestonesOutput, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: add ${id} "${title}"`,
          [".planning/FUTURE.md", ".planning/MILESTONES.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { id, title, realizes, status: "PENDING", committed, hash };
    }
    module2.exports = { runAddMilestone: runAddMilestone2 };
  }
});

// src/commands/add-milestones-batch.js
var require_add_milestones_batch = __commonJS({
  "src/commands/add-milestones-batch.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFutureFile, writeFutureFile } = require_future();
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runAddMilestonesBatch2(cwd, args) {
      const jsonRaw = parseFlag(args, "json");
      if (!jsonRaw) {
        return { error: "Missing required flag: --json (JSON array of { title, realizes })" };
      }
      let inputs;
      try {
        inputs = JSON.parse(jsonRaw);
      } catch {
        return { error: "Invalid JSON in --json flag" };
      }
      if (!Array.isArray(inputs) || inputs.length === 0) {
        return { error: "--json must be a non-empty array of { title, realizes }" };
      }
      for (let i = 0; i < inputs.length; i++) {
        if (!inputs[i].title) return { error: `Item ${i}: missing title` };
        if (!inputs[i].realizes) return { error: `Item ${i}: missing realizes` };
      }
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const projectName = basename(cwd);
      if (!existsSync(planningDir)) {
        mkdirSync(planningDir, { recursive: true });
      }
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones } = parseMilestonesFile(milestonesContent);
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
      }
      for (let i = 0; i < inputs.length; i++) {
        const realizesRaw = inputs[i].realizes;
        const realizes = Array.isArray(realizesRaw) ? realizesRaw.map((s) => String(s).trim()).filter(Boolean) : String(realizesRaw).split(",").map((s) => s.trim()).filter(Boolean);
        for (const declId of realizes) {
          if (!dag.getNode(declId)) {
            return { error: `Item ${i}: declaration not found: ${declId}` };
          }
        }
      }
      const results = [];
      for (const input of inputs) {
        const realizes = input.realizes.split(",").map((s) => s.trim()).filter(Boolean);
        const id = dag.nextId("milestone");
        dag.addNode(id, "milestone", input.title, "PENDING");
        milestones.push({
          id,
          title: input.title,
          description: input.description || "",
          status: "PENDING",
          realizes,
          hasPlan: false
        });
        for (const declId of realizes) {
          const decl = declarations.find((d) => d.id === declId);
          if (decl && !decl.milestones.includes(id)) {
            decl.milestones.push(id);
          }
        }
        results.push({ id, title: input.title, description: input.description || "", realizes, status: "PENDING" });
      }
      const futureOutput = writeFutureFile(declarations, projectName);
      writeFileSync(futurePath, futureOutput, "utf-8");
      const milestonesOutput = writeMilestonesFile(milestones, projectName);
      writeFileSync(milestonesPath, milestonesOutput, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const ids = results.map((r) => r.id).join(", ");
        const result = commitPlanningDocs2(
          cwd,
          `declare: add milestones ${ids}`,
          [".planning/FUTURE.md", ".planning/MILESTONES.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { milestones: results, committed, hash };
    }
    module2.exports = { runAddMilestonesBatch: runAddMilestonesBatch2 };
  }
});

// src/commands/add-action.js
var require_add_action = __commonJS({
  "src/commands/add-action.js"(exports2, module2) {
    "use strict";
    function runAddAction2(_cwd, _args) {
      return {
        error: `add-action has been replaced by create-plan. Use: node declare-tools.cjs create-plan --milestone M-XX --actions '[{"title":"...","produces":"..."}]'`
      };
    }
    module2.exports = { runAddAction: runAddAction2 };
  }
});

// src/commands/readiness.js
var require_readiness = __commonJS({
  "src/commands/readiness.js"(exports2, module2) {
    "use strict";
    var COMPLETED = /* @__PURE__ */ new Set(["DONE", "KEPT", "HONORED"]);
    function computeReadiness(graph) {
      const { milestones, actions } = graph;
      const milestoneStatus = {};
      for (const m of milestones) {
        milestoneStatus[m.id] = (m.status || "PENDING").toUpperCase();
      }
      const actionCounts = {};
      for (const m of milestones) {
        actionCounts[m.id] = { done: 0, total: 0 };
      }
      for (const a of actions) {
        const causes = a.causes || [];
        for (const mId of causes) {
          if (!actionCounts[mId]) continue;
          actionCounts[mId].total++;
          if (COMPLETED.has((a.status || "").toUpperCase())) {
            actionCounts[mId].done++;
          }
        }
      }
      const readiness = {};
      for (const m of milestones) {
        const status = milestoneStatus[m.id];
        const progress = actionCounts[m.id] || { done: 0, total: 0 };
        if (COMPLETED.has(status)) {
          readiness[m.id] = { state: "done", blockedBy: [], progress };
          continue;
        }
        const deps = m.dependsOn || [];
        const blockedBy = [];
        for (const depId of deps) {
          const depStatus = milestoneStatus[depId];
          if (!depStatus || !COMPLETED.has(depStatus)) {
            blockedBy.push(depId);
          }
        }
        if (blockedBy.length > 0) {
          readiness[m.id] = { state: "blocked", blockedBy, progress };
        } else if (progress.total === 0 && !m.hasPlan) {
          readiness[m.id] = { state: "no-actions", blockedBy: [], progress };
        } else {
          readiness[m.id] = { state: "ready", blockedBy: [], progress };
        }
      }
      return readiness;
    }
    module2.exports = { computeReadiness };
  }
});

// src/commands/load-graph.js
var require_load_graph = __commonJS({
  "src/commands/load-graph.js"(exports2, module2) {
    "use strict";
    var { buildDagFromDisk, loadActionsFromFolders } = require_build_dag();
    var { computeReadiness } = require_readiness();
    function runLoadGraph2(cwd) {
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag, declarations, milestones, actions } = graphResult;
      const wholeness = dag.computeWholeness();
      const enrichedMilestones = milestones.map((m) => ({
        ...m,
        classification: m.classification || "agent",
        dependsOn: m.dependsOn || [],
        wholeness: wholeness.get(m.id) || "broken"
      }));
      const enrichedActions = actions.map((a) => ({ ...a, wholeness: wholeness.get(a.id) || "broken" }));
      const readiness = computeReadiness({
        milestones: enrichedMilestones,
        actions: enrichedActions
      });
      return {
        declarations: declarations.map((d) => ({ ...d, wholeness: wholeness.get(d.id) || "broken" })),
        milestones: enrichedMilestones.map((m) => ({
          ...m,
          readiness: readiness[m.id] || { state: "blocked", blockedBy: [], progress: { done: 0, total: 0 } }
        })),
        actions: enrichedActions,
        readiness,
        stats: dag.stats(),
        validation: dag.validate()
      };
    }
    module2.exports = { runLoadGraph: runLoadGraph2, loadActionsFromFolders };
  }
});

// src/commands/create-plan.js
var require_create_plan = __commonJS({
  "src/commands/create-plan.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFutureFile } = require_future();
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { writePlanFile } = require_plan();
    var { loadActionsFromFolders } = require_load_graph();
    var { ensureMilestoneFolder } = require_milestone_folders();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runCreatePlan2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      const actionsRaw = parseFlag(args, "actions");
      if (!milestoneId) {
        return { error: "Missing required flag: --milestone" };
      }
      if (!actionsRaw) {
        return { error: "Missing required flag: --actions" };
      }
      let actionDefs;
      try {
        actionDefs = JSON.parse(actionsRaw);
        if (!Array.isArray(actionDefs)) {
          return { error: "--actions must be a JSON array of [{title, produces}]" };
        }
      } catch {
        return { error: "--actions must be valid JSON: " + actionsRaw };
      }
      const planningDir = join(cwd, ".planning");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const futurePath = join(planningDir, "FUTURE.md");
      const projectName = basename(cwd);
      if (!existsSync(planningDir)) {
        return { error: "No Declare project found. Run /declare:init first." };
      }
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones } = parseMilestonesFile(milestonesContent);
      const targetMs = milestones.find((m) => m.id === milestoneId);
      if (!targetMs) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
      }
      const { actions: existingActions } = loadActionsFromFolders(planningDir);
      for (const a of existingActions) {
        dag.addNode(a.id, "action", a.title, a.status || "PENDING");
      }
      const actions = actionDefs.map((def) => {
        const id = dag.nextId("action");
        dag.addNode(id, "action", def.title, "PENDING");
        return {
          id,
          title: def.title,
          status: "PENDING",
          produces: def.produces || ""
        };
      });
      const folder = ensureMilestoneFolder(planningDir, milestoneId, targetMs.title);
      const planContent = writePlanFile(milestoneId, targetMs.title, targetMs.realizes, actions);
      const planPath = join(folder, "PLAN.md");
      writeFileSync(planPath, planContent, "utf-8");
      targetMs.hasPlan = true;
      const msOutput = writeMilestonesFile(milestones, projectName);
      writeFileSync(milestonesPath, msOutput, "utf-8");
      const relFolder = folder.replace(cwd + "/", "");
      const filesToCommit = [
        ".planning/MILESTONES.md",
        join(relFolder, "PLAN.md")
      ];
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: create plan for ${milestoneId} "${targetMs.title}"`,
          filesToCommit
        );
        committed = result.committed;
        hash = result.hash;
      }
      return {
        milestone: milestoneId,
        folder: relFolder,
        actions: actions.map((a) => ({ id: a.id, title: a.title, produces: a.produces })),
        committed,
        hash
      };
    }
    module2.exports = { runCreatePlan: runCreatePlan2 };
  }
});

// src/commands/trace.js
var require_trace = __commonJS({
  "src/commands/trace.js"(exports2, module2) {
    "use strict";
    var { writeFileSync } = require("node:fs");
    var { resolve } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    function traceUpward(dag, startId) {
      const startNode = dag.getNode(startId);
      if (!startNode) return [];
      if (startNode.type === "declaration") {
        return [[{ id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status }]];
      }
      const upstream = dag.getUpstream(startId);
      if (upstream.length === 0) {
        return [[{ id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status }]];
      }
      const paths = [];
      const startEntry = { id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status };
      for (const parent of upstream) {
        const parentPaths = traceUpward(dag, parent.id);
        for (const parentPath of parentPaths) {
          paths.push([startEntry, ...parentPath]);
        }
      }
      return paths;
    }
    function formatTracePaths(nodeId, node, paths) {
      if (paths.length === 0) {
        return `${nodeId}: (not found)
`;
      }
      const lines = [];
      lines.push(`${node.id}: ${node.title} [${node.status}]`);
      if (paths.length === 1 && paths[0].length === 1) {
        lines.push("  (no upstream connections)");
        return lines.join("\n") + "\n";
      }
      const byFirstUpstream = /* @__PURE__ */ new Map();
      for (const path of paths) {
        if (path.length < 2) continue;
        const firstUp = path[1];
        if (!byFirstUpstream.has(firstUp.id)) {
          byFirstUpstream.set(firstUp.id, []);
        }
        byFirstUpstream.get(firstUp.id).push(path);
      }
      const upstreamIds = [...byFirstUpstream.keys()];
      for (let i = 0; i < upstreamIds.length; i++) {
        const upId = upstreamIds[i];
        const groupPaths = byFirstUpstream.get(upId);
        const isLast = i === upstreamIds.length - 1;
        const connector = isLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
        const indent = isLast ? "    " : "\u2502   ";
        const upNode = groupPaths[0][1];
        lines.push(`${connector} ${upNode.id}: ${upNode.title} [${upNode.status}]`);
        const declNodes = /* @__PURE__ */ new Map();
        for (const path of groupPaths) {
          if (path.length > 2) {
            const decl = path[2];
            declNodes.set(decl.id, decl);
          }
        }
        const declList = [...declNodes.values()];
        for (let j = 0; j < declList.length; j++) {
          const decl = declList[j];
          const declIsLast = j === declList.length - 1;
          const declConnector = declIsLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
          lines.push(`${indent}${declConnector} ${decl.id}: ${decl.title} [${decl.status}]`);
        }
      }
      return lines.join("\n") + "\n";
    }
    function runTrace2(cwd, args) {
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag } = graphResult;
      const nodeId = parseFlag(args, "node") || (args[0] && !args[0].startsWith("--") ? args[0] : null);
      const outputFile = parseFlag(args, "output");
      if (!nodeId) {
        const declarations = dag.getDeclarations().map((n) => ({ id: n.id, title: n.title, status: n.status }));
        const milestones = dag.getMilestones().map((n) => ({ id: n.id, title: n.title, status: n.status }));
        const actions = dag.getActions().map((n) => ({ id: n.id, title: n.title, status: n.status }));
        return {
          nodes: {
            declarations,
            milestones,
            actions,
            total: declarations.length + milestones.length + actions.length
          }
        };
      }
      const node = dag.getNode(nodeId);
      if (!node) {
        return { error: `Node not found: ${nodeId}. Use 'trace' without arguments to see available nodes.` };
      }
      let paths = traceUpward(dag, nodeId);
      let truncated = false;
      let totalPaths = paths.length;
      if (paths.length > 20) {
        paths = paths.slice(0, 20);
        truncated = true;
      }
      const nodeInfo = { id: node.id, type: node.type, title: node.title, status: node.status };
      const formatted = formatTracePaths(nodeId, nodeInfo, paths);
      let resolvedOutput;
      if (outputFile) {
        resolvedOutput = resolve(cwd, outputFile);
        writeFileSync(resolvedOutput, formatted, "utf-8");
      }
      const result = {
        nodeId,
        node: nodeInfo,
        paths,
        pathCount: paths.length,
        formatted
      };
      if (truncated) {
        result.truncated = true;
        result.totalPaths = totalPaths;
      }
      if (resolvedOutput) {
        result.outputFile = resolvedOutput;
      }
      return result;
    }
    module2.exports = { runTrace: runTrace2, traceUpward, formatTracePaths };
  }
});

// src/commands/prioritize.js
var require_prioritize = __commonJS({
  "src/commands/prioritize.js"(exports2, module2) {
    "use strict";
    var { writeFileSync } = require("node:fs");
    var { resolve } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    function dependencyWeight(dag, nodeId) {
      const visited = /* @__PURE__ */ new Set();
      const queue = [nodeId];
      while (queue.length > 0) {
        const current = (
          /** @type {string} */
          queue.shift()
        );
        if (visited.has(current)) continue;
        visited.add(current);
        const upstream = dag.getUpstream(current);
        for (const parent of upstream) {
          if (!visited.has(parent.id)) {
            queue.push(parent.id);
          }
        }
      }
      return visited.size - 1;
    }
    function getSubtreeNodeIds(dag, rootId) {
      const visited = /* @__PURE__ */ new Set();
      const queue = [rootId];
      while (queue.length > 0) {
        const current = (
          /** @type {string} */
          queue.shift()
        );
        if (visited.has(current)) continue;
        visited.add(current);
        const downstream = dag.getDownstream(current);
        for (const child of downstream) {
          if (!visited.has(child.id)) {
            queue.push(child.id);
          }
        }
      }
      return visited;
    }
    function rankActions(dag, filterDeclarationId) {
      let actions = dag.getActions();
      if (filterDeclarationId) {
        const subtreeNodes = getSubtreeNodeIds(dag, filterDeclarationId);
        actions = actions.filter((a) => subtreeNodes.has(a.id));
      }
      const ranked = actions.map((a) => ({
        id: a.id,
        title: a.title,
        score: dependencyWeight(dag, a.id)
      }));
      ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      return ranked.map((item, index) => ({
        rank: index + 1,
        ...item
      }));
    }
    function formatRanking(ranking, filter) {
      const lines = [];
      if (filter) {
        lines.push(`Priority ranking (filtered by ${filter}):`);
      } else {
        lines.push("Priority ranking (all actions):");
      }
      lines.push("");
      if (ranking.length === 0) {
        lines.push("  No actions found.");
        return lines.join("\n") + "\n";
      }
      for (const item of ranking) {
        lines.push(`  ${item.rank}. ${item.id}: ${item.title} (score: ${item.score})`);
      }
      return lines.join("\n") + "\n";
    }
    function runPrioritize2(cwd, args) {
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag } = graphResult;
      const filterDeclaration = parseFlag(args, "declaration");
      const outputFile = parseFlag(args, "output");
      if (filterDeclaration) {
        const filterNode = dag.getNode(filterDeclaration);
        if (!filterNode) {
          return { error: `Declaration not found: ${filterDeclaration}. Use a valid D-XX ID.` };
        }
        if (filterNode.type !== "declaration") {
          return { error: `${filterDeclaration} is a ${filterNode.type}, not a declaration. Use --declaration with a D-XX ID.` };
        }
      }
      const ranking = rankActions(dag, filterDeclaration || void 0);
      const formatted = formatRanking(ranking, filterDeclaration);
      const result = {
        ranking,
        filter: filterDeclaration || null,
        totalActions: ranking.length,
        formatted
      };
      if (outputFile) {
        const resolvedOutput = resolve(cwd, outputFile);
        writeFileSync(resolvedOutput, formatted, "utf-8");
        result.outputFile = resolvedOutput;
      }
      return result;
    }
    module2.exports = { runPrioritize: runPrioritize2, dependencyWeight, getSubtreeNodeIds, rankActions };
  }
});

// src/commands/visualize.js
var require_visualize = __commonJS({
  "src/commands/visualize.js"(exports2, module2) {
    "use strict";
    var { writeFileSync } = require("node:fs");
    var { resolve } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    function getSubtreeNodeIds(dag, rootId) {
      const visited = /* @__PURE__ */ new Set();
      const queue = [rootId];
      while (queue.length > 0) {
        const current = (
          /** @type {string} */
          queue.shift()
        );
        if (visited.has(current)) continue;
        visited.add(current);
        const downstream = dag.getDownstream(current);
        for (const child of downstream) {
          if (!visited.has(child.id)) {
            queue.push(child.id);
          }
        }
      }
      return visited;
    }
    function statusMarker(dag, node) {
      if (node.status === "DONE") return "[\u2713]";
      if (node.status === "ACTIVE") return "[>]";
      const children = dag.getDownstream(node.id);
      if (children.length > 0) {
        const hasNonDoneChild = children.some((c) => c.status !== "DONE");
        if (hasNonDoneChild) return "[!]";
      }
      return "[\u25CB]";
    }
    function sortById(nodes) {
      return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
    }
    function buildTreeData(dag, scopeFilter) {
      const declarations = sortById(dag.getDeclarations());
      const tree = [];
      for (const decl of declarations) {
        if (scopeFilter && !scopeFilter.has(decl.id)) continue;
        const declEntry = {
          node: { id: decl.id, type: decl.type, title: decl.title, status: decl.status, marker: statusMarker(dag, decl) },
          children: []
        };
        const milestones = sortById(dag.getDownstream(decl.id));
        for (const ms of milestones) {
          if (scopeFilter && !scopeFilter.has(ms.id)) continue;
          const msEntry = {
            node: { id: ms.id, type: ms.type, title: ms.title, status: ms.status, marker: statusMarker(dag, ms) },
            children: []
          };
          const actions = sortById(dag.getDownstream(ms.id));
          for (const act of actions) {
            if (scopeFilter && !scopeFilter.has(act.id)) continue;
            msEntry.children.push({
              node: { id: act.id, type: act.type, title: act.title, status: act.status, marker: statusMarker(dag, act) },
              children: []
            });
          }
          declEntry.children.push(msEntry);
        }
        tree.push(declEntry);
      }
      if (tree.length === 0 && scopeFilter) {
        const milestones = sortById(dag.getMilestones());
        for (const ms of milestones) {
          if (!scopeFilter.has(ms.id)) continue;
          const msEntry = {
            node: { id: ms.id, type: ms.type, title: ms.title, status: ms.status, marker: statusMarker(dag, ms) },
            children: []
          };
          const actions = sortById(dag.getDownstream(ms.id));
          for (const act of actions) {
            if (scopeFilter && !scopeFilter.has(act.id)) continue;
            msEntry.children.push({
              node: { id: act.id, type: act.type, title: act.title, status: act.status, marker: statusMarker(dag, act) },
              children: []
            });
          }
          tree.push(msEntry);
        }
      }
      return tree;
    }
    function formatTree(tree) {
      const lines = [];
      for (const root of tree) {
        lines.push(`${root.node.id}: ${root.node.title} ${root.node.marker}`);
        renderChildren(root.children, "", lines);
        lines.push("");
      }
      while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      return lines.join("\n") + "\n";
    }
    function renderChildren(children, prefix, lines) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const isLast = i === children.length - 1;
        const connector = isLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
        const childPrefix = isLast ? `${prefix}    ` : `${prefix}\u2502   `;
        lines.push(`${prefix}${connector} ${child.node.id}: ${child.node.title} ${child.node.marker}`);
        if (child.children.length > 0) {
          renderChildren(child.children, childPrefix, lines);
        }
      }
    }
    function runVisualize2(cwd, args) {
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag } = graphResult;
      const scopeId = args[0] && !args[0].startsWith("--") ? args[0] : null;
      const outputFile = parseFlag(args, "output");
      let scopeFilter = null;
      if (scopeId) {
        const scopeNode = dag.getNode(scopeId);
        if (!scopeNode) {
          return { error: `Node not found: ${scopeId}. Use a valid D-XX or M-XX ID.` };
        }
        scopeFilter = getSubtreeNodeIds(dag, scopeId);
      }
      const tree = buildTreeData(dag, scopeFilter);
      const formatted = formatTree(tree);
      let declCount = 0;
      let msCount = 0;
      let actCount = 0;
      function countNodes(nodes) {
        for (const entry of nodes) {
          const type = entry.node.type;
          if (type === "declaration") declCount++;
          else if (type === "milestone") msCount++;
          else if (type === "action") actCount++;
          countNodes(entry.children);
        }
      }
      countNodes(tree);
      const result = {
        scope: scopeId || "full",
        tree,
        formatted,
        stats: { declarations: declCount, milestones: msCount, actions: actCount }
      };
      if (outputFile) {
        const resolvedOutput = resolve(cwd, outputFile);
        writeFileSync(resolvedOutput, formatted, "utf-8");
        result.outputFile = resolvedOutput;
      }
      return result;
    }
    module2.exports = { runVisualize: runVisualize2, getSubtreeNodeIds, buildTreeData, formatTree, statusMarker };
  }
});

// src/commands/compute-waves.js
var require_compute_waves = __commonJS({
  "src/commands/compute-waves.js"(exports2, module2) {
    "use strict";
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { isCompleted } = require_engine();
    function runComputeWaves2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      if (!milestoneId) {
        return { error: "Missing --milestone flag. Usage: compute-waves --milestone M-XX" };
      }
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const actions = dag.getDownstream(milestoneId).filter((n) => n.type === "action" && !isCompleted(n.status));
      if (actions.length === 0) {
        return {
          milestoneId,
          milestoneTitle: milestone.title,
          declarations: [],
          waves: [],
          totalActions: 0,
          allDone: true
        };
      }
      const wave1Actions = actions.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        produces: a.metadata.produces || ""
      })).sort((a, b) => a.id.localeCompare(b.id));
      const upstream = dag.getUpstream(milestoneId);
      const declarations = upstream.filter((n) => n.type === "declaration").map((n) => ({ id: n.id, title: n.title }));
      return {
        milestoneId,
        milestoneTitle: milestone.title,
        declarations,
        waves: [{ wave: 1, actions: wave1Actions }],
        totalActions: wave1Actions.length,
        allDone: false
      };
    }
    module2.exports = { runComputeWaves: runComputeWaves2 };
  }
});

// src/artifacts/exec-plan.js
var require_exec_plan = __commonJS({
  "src/artifacts/exec-plan.js"(exports2, module2) {
    "use strict";
    var { traceUpward } = require_trace();
    function buildWhyChain(paths, milestoneId, milestoneTitle) {
      const declMap = /* @__PURE__ */ new Map();
      for (const path of paths) {
        for (const node of path) {
          if (node.type === "declaration") {
            declMap.set(node.id, node.title);
          }
        }
      }
      const declarations = [...declMap.entries()].map(([id, title]) => ({ id, title }));
      const declStrings = declarations.map((d) => `${d.id}: ${d.title}`);
      const whyChain = declStrings.length > 0 ? `This action causes ${milestoneId} ("${milestoneTitle}") which realizes ${declStrings.join(", ")}` : `This action causes ${milestoneId} ("${milestoneTitle}")`;
      return { whyChain, declarations };
    }
    function generateExecPlan(dag, actionId, milestoneId, waveNumber) {
      const action = dag.getNode(actionId);
      const milestone = dag.getNode(milestoneId);
      if (!action) {
        return `# Error: Action ${actionId} not found in DAG
`;
      }
      if (!milestone) {
        return `# Error: Milestone ${milestoneId} not found in DAG
`;
      }
      const paths = traceUpward(dag, actionId);
      const { whyChain, declarations } = buildWhyChain(paths, milestoneId, milestone.title);
      const produces = action.metadata.produces || "";
      const description = action.metadata.description || action.title;
      const contextRefs = [
        "@.planning/FUTURE.md",
        "@.planning/MILESTONES.md"
      ];
      const lines = [
        "---",
        `phase: ${milestoneId}`,
        `plan: ${actionId}`,
        "type: execute",
        `wave: ${waveNumber}`,
        "depends_on: []",
        "files_modified: []",
        "autonomous: true",
        "---",
        "",
        "<objective>",
        action.title,
        "",
        `Purpose: ${whyChain}`,
        `Output: ${produces || "See action description"}`,
        "</objective>",
        "",
        "<context>",
        ...contextRefs,
        "</context>",
        "",
        "<tasks>",
        "",
        '<task type="auto">',
        `  <name>Task 1: ${action.title}</name>`,
        `  <files>${produces || "TBD - executor determines from action scope"}</files>`,
        "  <action>",
        description,
        "",
        `Context: ${whyChain}`,
        "  </action>",
        `  <verify>Verify that the action's output exists and functions correctly</verify>`,
        `  <done>${produces || action.title} is complete and verified</done>`,
        "</task>",
        "",
        "</tasks>",
        "",
        "<verification>",
        "1. Action produces artifacts exist on disk",
        "2. Any tests related to this action pass",
        "3. Git commits reflect the work done",
        "</verification>",
        "",
        "<success_criteria>",
        `${action.title} is complete, verified, and advances milestone ${milestoneId}`,
        "</success_criteria>",
        "",
        "<output>",
        "After completion, commit atomically and report results to orchestrator.",
        "</output>",
        ""
      ];
      return lines.join("\n");
    }
    module2.exports = { generateExecPlan, buildWhyChain };
  }
});

// src/commands/generate-exec-plan.js
var require_generate_exec_plan = __commonJS({
  "src/commands/generate-exec-plan.js"(exports2, module2) {
    "use strict";
    var { writeFileSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { generateExecPlan } = require_exec_plan();
    var { findMilestoneFolder } = require_milestone_folders();
    function runGenerateExecPlan2(cwd, args) {
      const actionId = parseFlag(args, "action");
      if (!actionId) {
        return { error: "Missing --action flag. Usage: generate-exec-plan --action A-XX --milestone M-XX" };
      }
      const milestoneId = parseFlag(args, "milestone");
      if (!milestoneId) {
        return { error: "Missing --milestone flag. Usage: generate-exec-plan --action A-XX --milestone M-XX" };
      }
      const waveStr = parseFlag(args, "wave");
      const wave = waveStr ? parseInt(waveStr, 10) : 1;
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const action = dag.getNode(actionId);
      if (!action) {
        return { error: `Action not found: ${actionId}` };
      }
      if (action.type !== "action") {
        return { error: `${actionId} is not an action (type: ${action.type})` };
      }
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const content = generateExecPlan(dag, actionId, milestoneId, wave);
      const planningDir = join(cwd, ".planning");
      const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
      if (!milestoneFolder) {
        return { error: `Milestone folder not found for ${milestoneId}. Run /declare:actions first to create the milestone plan.` };
      }
      const numericSuffix = actionId.split("-")[1];
      const filename = `EXEC-PLAN-${numericSuffix}.md`;
      const outputPath = join(milestoneFolder, filename);
      writeFileSync(outputPath, content, "utf-8");
      return {
        actionId,
        milestoneId,
        wave,
        outputPath,
        content: content.substring(0, 200)
      };
    }
    module2.exports = { runGenerateExecPlan: runGenerateExecPlan2 };
  }
});

// src/commands/verify-wave.js
var require_verify_wave = __commonJS({
  "src/commands/verify-wave.js"(exports2, module2) {
    "use strict";
    var { existsSync } = require("node:fs");
    var { resolve } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { traceUpward } = require_trace();
    var { isCompleted } = require_engine();
    function looksLikeFilePath(produces) {
      if (!produces || produces.trim() === "") return false;
      return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
    }
    function runVerifyWave2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      if (!milestoneId) {
        return { error: 'Missing --milestone flag. Usage: verify-wave --milestone M-XX --actions "A-01,A-02"' };
      }
      const actionsStr = parseFlag(args, "actions");
      if (!actionsStr) {
        return { error: 'Missing --actions flag. Usage: verify-wave --milestone M-XX --actions "A-01,A-02"' };
      }
      const completedActionIds = actionsStr.split(",").map((s) => s.trim()).filter(Boolean);
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const allChecks = [];
      const completedActions = [];
      for (const actionId of completedActionIds) {
        const action = dag.getNode(actionId);
        allChecks.push({
          actionId,
          check: "action-exists",
          passed: !!action
        });
        if (!action) {
          completedActions.push({ id: actionId, title: "(not found)", producesExist: null });
          continue;
        }
        const produces = action.metadata.produces || "";
        if (looksLikeFilePath(produces)) {
          const filePath = resolve(cwd, produces);
          const exists = existsSync(filePath);
          allChecks.push({
            actionId,
            check: "produces-exist",
            passed: exists
          });
          completedActions.push({ id: actionId, title: action.title, producesExist: exists });
        } else {
          allChecks.push({
            actionId,
            check: "produces-exist",
            passed: true
          });
          completedActions.push({ id: actionId, title: action.title, producesExist: null });
        }
      }
      const allMilestoneActions = dag.getDownstream(milestoneId).filter((n) => n.type === "action");
      const milestoneCompletable = allMilestoneActions.every(
        (a) => isCompleted(a.status) || completedActionIds.includes(a.id)
      );
      const paths = traceUpward(dag, milestoneId);
      const declMap = /* @__PURE__ */ new Map();
      for (const path of paths) {
        for (const node of path) {
          if (node.type === "declaration") {
            declMap.set(node.id, node.title);
          }
        }
      }
      const declarations = [...declMap.entries()].map(([id, title]) => ({ id, title }));
      const declStrings = declarations.map((d) => `${d.id}: ${d.title}`);
      const whyChain = declStrings.length > 0 ? `${milestoneId} ("${milestone.title}") realizes ${declStrings.join(", ")}` : `${milestoneId} ("${milestone.title}")`;
      const passed = allChecks.every((c) => c.passed);
      return {
        milestoneId,
        milestoneTitle: milestone.title,
        completedActions,
        milestoneCompletable,
        traceContext: {
          declarations,
          whyChain
        },
        allChecks,
        passed
      };
    }
    module2.exports = { runVerifyWave: runVerifyWave2 };
  }
});

// src/commands/execute.js
var require_execute = __commonJS({
  "src/commands/execute.js"(exports2, module2) {
    "use strict";
    var { join } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { findMilestoneFolder } = require_milestone_folders();
    var { isCompleted } = require_engine();
    function runExecute2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag, milestones } = graphResult;
      if (!milestoneId) {
        const milestonePicker = milestones.map((m) => {
          const actions = dag.getDownstream(m.id).filter((n) => n.type === "action");
          const doneCount2 = actions.filter((a) => isCompleted(a.status)).length;
          return {
            id: m.id,
            title: m.title,
            status: m.status,
            actionCount: actions.length,
            doneCount: doneCount2
          };
        });
        return { milestones: milestonePicker };
      }
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const allActionsRaw = dag.getDownstream(milestoneId).filter((n) => n.type === "action");
      const allActions = allActionsRaw.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        produces: a.metadata.produces || ""
      })).sort((a, b) => a.id.localeCompare(b.id));
      const pendingActions = allActions.filter((a) => !isCompleted(a.status));
      const doneCount = allActions.length - pendingActions.length;
      const waves = [];
      if (pendingActions.length > 0) {
        waves.push({ wave: 1, actions: pendingActions });
      }
      const upstream = dag.getUpstream(milestoneId);
      const declarations = upstream.filter((n) => n.type === "declaration").map((n) => ({ id: n.id, title: n.title }));
      const planningDir = join(cwd, ".planning");
      const milestoneFolderPath = findMilestoneFolder(planningDir, milestoneId);
      return {
        milestoneId,
        milestoneTitle: milestone.title,
        status: milestone.status,
        declarations,
        allActions,
        pendingActions,
        waves,
        totalActions: allActions.length,
        pendingCount: pendingActions.length,
        doneCount,
        allDone: pendingActions.length === 0,
        milestoneFolderPath
      };
    }
    module2.exports = { runExecute: runExecute2 };
  }
});

// src/commands/verify-milestone.js
var require_verify_milestone = __commonJS({
  "src/commands/verify-milestone.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, statSync } = require("node:fs");
    var { resolve, join } = require("node:path");
    var { execFileSync } = require("node:child_process");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { findMilestoneFolder } = require_milestone_folders();
    var { parsePlanFile } = require_plan();
    var { traceUpward } = require_trace();
    function looksLikeFilePath(produces) {
      if (!produces || produces.trim() === "") return false;
      return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
    }
    function runVerifyMilestone2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      if (!milestoneId) {
        return { error: "Missing --milestone flag. Usage: verify-milestone --milestone M-XX" };
      }
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const planningDir = join(cwd, ".planning");
      const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
      const criteria = [];
      let scCounter = 1;
      if (milestoneFolder) {
        const planPath = join(milestoneFolder, "PLAN.md");
        if (existsSync(planPath)) {
          const planContent = readFileSync(planPath, "utf-8");
          const plan = parsePlanFile(planContent);
          for (const action of plan.actions) {
            if (!action.produces) continue;
            if (looksLikeFilePath(action.produces)) {
              const filePath = resolve(cwd, action.produces);
              const exists = existsSync(filePath);
              let evidence = exists ? `File exists` : `File not found: ${action.produces}`;
              if (exists) {
                try {
                  const stats = statSync(filePath);
                  evidence = `File exists (${stats.size} bytes)`;
                } catch {
                }
              }
              criteria.push({
                id: `SC-${String(scCounter).padStart(2, "0")}`,
                type: "artifact",
                passed: exists,
                description: `${action.id} produces ${action.produces}`,
                evidence,
                actionId: action.id
              });
              scCounter++;
            }
          }
        }
      }
      const packagePath = join(cwd, "package.json");
      if (existsSync(packagePath)) {
        try {
          const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
          if (pkg.scripts && pkg.scripts.test) {
            let testPassed = false;
            let testEvidence = "";
            try {
              const result = execFileSync("npm", ["test"], {
                cwd,
                timeout: 6e4,
                stdio: "pipe"
              });
              testPassed = true;
              testEvidence = "npm test exited with code 0";
            } catch (err) {
              testPassed = false;
              const stderr = err.stderr ? err.stderr.toString().slice(0, 200) : "";
              testEvidence = `npm test failed (exit code ${err.status || "unknown"}): ${stderr}`;
            }
            criteria.push({
              id: `SC-${String(scCounter).padStart(2, "0")}`,
              type: "test",
              passed: testPassed,
              description: "npm test passes",
              evidence: testEvidence
            });
            scCounter++;
          }
        } catch {
        }
      }
      criteria.push({
        id: `SC-${String(scCounter).padStart(2, "0")}`,
        type: "ai",
        passed: null,
        description: "AI assessment of milestone truth alignment",
        evidence: null
      });
      const programmaticCriteria = criteria.filter((c) => c.type !== "ai");
      const programmaticPassed = programmaticCriteria.length === 0 || programmaticCriteria.every((c) => c.passed === true);
      const paths = traceUpward(dag, milestoneId);
      const declMap = /* @__PURE__ */ new Map();
      for (const path of paths) {
        for (const node of path) {
          if (node.type === "declaration") {
            declMap.set(node.id, node.title);
          }
        }
      }
      const declarations = [...declMap.entries()].map(([id, title]) => ({ id, title }));
      const declStrings = declarations.map((d) => `${d.id}: ${d.title}`);
      const whyChain = declStrings.length > 0 ? `${milestoneId} ("${milestone.title}") realizes ${declStrings.join(", ")}` : `${milestoneId} ("${milestone.title}")`;
      return {
        milestoneId,
        milestoneTitle: milestone.title,
        milestoneFolder,
        criteria,
        programmaticPassed,
        aiAssessmentNeeded: true,
        traceContext: {
          declarations,
          whyChain
        }
      };
    }
    module2.exports = { runVerifyMilestone: runVerifyMilestone2 };
  }
});

// src/commands/check-drift.js
var require_check_drift = __commonJS({
  "src/commands/check-drift.js"(exports2, module2) {
    "use strict";
    var { buildDagFromDisk } = require_build_dag();
    var { findOrphans } = require_engine();
    function findNearestConnections(dag, orphanId) {
      const node = dag.getNode(orphanId);
      if (!node) return [];
      const suggestions = [];
      if (node.type === "action") {
        const milestones = dag.getMilestones();
        for (const m of milestones) {
          const downstream = dag.getDownstream(m.id);
          const hasActions = downstream.some((d) => d.type === "action");
          if (hasActions) {
            suggestions.push({
              type: "connect",
              target: m.id,
              targetTitle: m.title,
              reason: `Milestone already has ${downstream.filter((d) => d.type === "action").length} action(s)`
            });
          }
          if (suggestions.length >= 3) break;
        }
        if (suggestions.length === 0) {
          for (const m of milestones) {
            suggestions.push({
              type: "connect",
              target: m.id,
              targetTitle: m.title,
              reason: "Available milestone"
            });
            if (suggestions.length >= 3) break;
          }
        }
      } else if (node.type === "milestone") {
        const declarations = dag.getDeclarations();
        for (const d of declarations) {
          if (d.status === "ACTIVE" || d.status === "PENDING") {
            suggestions.push({
              type: "connect",
              target: d.id,
              targetTitle: d.title,
              reason: `Declaration is ${d.status}`
            });
          }
          if (suggestions.length >= 3) break;
        }
        if (suggestions.length === 0) {
          for (const d of declarations) {
            suggestions.push({
              type: "connect",
              target: d.id,
              targetTitle: d.title,
              reason: "Available declaration"
            });
            if (suggestions.length >= 3) break;
          }
        }
      }
      return suggestions.slice(0, 3);
    }
    function runCheckDrift2(cwd) {
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const orphans = findOrphans(dag);
      const driftedNodes = orphans.map((orphan) => ({
        id: orphan.id,
        type: orphan.type,
        title: orphan.title,
        status: orphan.status,
        suggestions: findNearestConnections(dag, orphan.id)
      }));
      return {
        hasDrift: driftedNodes.length > 0,
        driftedNodes
      };
    }
    module2.exports = { runCheckDrift: runCheckDrift2 };
  }
});

// src/commands/check-occurrence.js
var require_check_occurrence = __commonJS({
  "src/commands/check-occurrence.js"(exports2, module2) {
    "use strict";
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { isCompleted } = require_engine();
    function runCheckOccurrence2(cwd, args) {
      const targetDecl = parseFlag(args || [], "declaration");
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const allDeclarations = dag.getDeclarations();
      const declarations = targetDecl ? allDeclarations.filter((d) => d.id === targetDecl) : allDeclarations;
      if (targetDecl && declarations.length === 0) {
        return { error: `Declaration not found: ${targetDecl}` };
      }
      const result = declarations.map((decl) => {
        const downstream = dag.getDownstream(decl.id);
        const milestones = downstream.filter((n) => n.type === "milestone");
        let totalActions = 0;
        let completedActions = 0;
        for (const m of milestones) {
          const mDownstream = dag.getDownstream(m.id);
          const actions = mDownstream.filter((n) => n.type === "action");
          totalActions += actions.length;
          completedActions += actions.filter((a) => isCompleted(a.status)).length;
        }
        return {
          declarationId: decl.id,
          statement: decl.metadata?.statement || decl.title,
          status: decl.status,
          milestoneCount: milestones.length,
          milestones: milestones.map((m) => ({
            id: m.id,
            title: m.title,
            status: m.status
          })),
          actionSummary: {
            total: totalActions,
            completed: completedActions
          }
        };
      });
      return { declarations: result };
    }
    module2.exports = { runCheckOccurrence: runCheckOccurrence2 };
  }
});

// src/commands/renegotiate.js
var require_renegotiate = __commonJS({
  "src/commands/renegotiate.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { parseFutureFile, writeFutureFile, appendToArchive } = require_future();
    var { isCompleted } = require_engine();
    function runRenegotiate2(cwd, args) {
      const declId = parseFlag(args || [], "declaration");
      const reason = parseFlag(args || [], "reason");
      if (!declId) {
        return { error: 'Missing --declaration flag. Usage: renegotiate --declaration D-XX --reason "..."' };
      }
      if (!reason) {
        return { error: 'Missing --reason flag. Usage: renegotiate --declaration D-XX --reason "..."' };
      }
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const declNode = dag.getNode(declId);
      if (!declNode || declNode.type !== "declaration") {
        return { error: `Declaration not found: ${declId}` };
      }
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      const archivePath = join(planningDir, "FUTURE-ARCHIVE.md");
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const declEntry = declarations.find((d) => d.id === declId);
      if (!declEntry) {
        return { error: `Declaration ${declId} not found in FUTURE.md` };
      }
      declEntry.status = "RENEGOTIATED";
      const headerMatch = futureContent.match(/^# Future: (.+)/m);
      const projectName = headerMatch ? headerMatch[1].trim() : "Project";
      writeFileSync(futurePath, writeFutureFile(declarations, projectName));
      const archivedAt = (/* @__PURE__ */ new Date()).toISOString();
      const existingArchive = existsSync(archivePath) ? readFileSync(archivePath, "utf-8") : "";
      const updatedArchive = appendToArchive(existingArchive, {
        id: declId,
        title: declEntry.title,
        statement: declEntry.statement,
        archivedAt,
        reason,
        replacedBy: "",
        statusAtArchive: "RENEGOTIATED"
      });
      writeFileSync(archivePath, updatedArchive);
      const downstream = dag.getDownstream(declId);
      const milestones = downstream.filter((n) => n.type === "milestone");
      const orphanedMilestones = [];
      for (const m of milestones) {
        const upstream = dag.getUpstream(m.id);
        const realizesOnlyThis = upstream.length === 1 && upstream[0].id === declId;
        if (realizesOnlyThis) {
          const mDownstream = dag.getDownstream(m.id);
          const actions = mDownstream.filter((n) => n.type === "action").map((a) => ({ id: a.id, title: a.title, status: a.status }));
          orphanedMilestones.push({
            id: m.id,
            title: m.title,
            status: m.status,
            actions
          });
        }
      }
      return {
        archived: { id: declId, title: declEntry.title, archivedAt },
        orphanedMilestones,
        archivePath,
        nextStep: "Create replacement declaration or reassign milestones"
      };
    }
    module2.exports = { runRenegotiate: runRenegotiate2 };
  }
});

// src/commands/complete-milestone.js
var require_complete_milestone = __commonJS({
  "src/commands/complete-milestone.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFlag } = require_parse_args();
    function normalizeVersion(raw) {
      return raw.startsWith("v") ? raw : `v${raw}`;
    }
    function copyDir(src, dest) {
      mkdirSync(dest, { recursive: true });
      const copied = [];
      for (const entry of readdirSync(src)) {
        const srcPath = join(src, entry);
        const destPath = join(dest, entry);
        const stat = statSync(srcPath);
        if (stat.isDirectory()) {
          const subCopied = copyDir(srcPath, destPath);
          for (const f of subCopied) copied.push(join(entry, f));
        } else {
          copyFileSync(srcPath, destPath);
          copied.push(entry);
        }
      }
      return copied;
    }
    function runCompleteMilestone2(cwd, args) {
      const versionRaw = parseFlag(args, "version");
      if (!versionRaw) {
        return { error: "Missing required flag: --version (e.g., --version v1.0)" };
      }
      const version = normalizeVersion(versionRaw);
      const planningDir = join(cwd, ".planning");
      const milestonesDir = join(planningDir, "milestones");
      const archiveDir = join(milestonesDir, version);
      if (!existsSync(planningDir)) {
        return { error: ".planning/ directory not found. Run /declare:init first." };
      }
      if (existsSync(archiveDir)) {
        return { error: `Archive already exists for ${version} at .planning/milestones/${version}/. Delete it first to re-archive.` };
      }
      const futurePath = join(planningDir, "FUTURE.md");
      const milestonesFilePath = join(planningDir, "MILESTONES.md");
      if (!existsSync(futurePath)) {
        return { error: "FUTURE.md not found in .planning/. Cannot archive." };
      }
      if (!existsSync(milestonesFilePath)) {
        return { error: "MILESTONES.md not found in .planning/. Cannot archive." };
      }
      mkdirSync(archiveDir, { recursive: true });
      const archivedFiles = [];
      const archiveFuture = join(archiveDir, "FUTURE.md");
      copyFileSync(futurePath, archiveFuture);
      archivedFiles.push(`milestones/${version}/FUTURE.md`);
      const archiveMilestones = join(archiveDir, "MILESTONES.md");
      copyFileSync(milestonesFilePath, archiveMilestones);
      archivedFiles.push(`milestones/${version}/MILESTONES.md`);
      const milestonesFolderBase = milestonesDir;
      if (existsSync(milestonesFolderBase)) {
        const entries = readdirSync(milestonesFolderBase);
        for (const entry of entries) {
          if (/^M-\d+/.test(entry)) {
            const srcFolder = join(milestonesFolderBase, entry);
            const stat = statSync(srcFolder);
            if (stat.isDirectory()) {
              const destFolder = join(archiveDir, entry);
              const copied = copyDir(srcFolder, destFolder);
              for (const f of copied) {
                archivedFiles.push(`milestones/${version}/${entry}/${f}`);
              }
            }
          }
        }
      }
      return {
        version,
        archivedFiles,
        gitTagReady: true
      };
    }
    module2.exports = { runCompleteMilestone: runCompleteMilestone2 };
  }
});

// src/commands/sync-status.js
var require_sync_status = __commonJS({
  "src/commands/sync-status.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync } = require("node:fs");
    var { join, resolve } = require("node:path");
    var { buildDagFromDisk, loadActionsFromFolders } = require_build_dag();
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { parseFutureFile, writeFutureFile } = require_future();
    var { parsePlanFile, updateActionStatus } = require_plan();
    var { findMilestoneFolder } = require_milestone_folders();
    var { isCompleted } = require_engine();
    function looksLikeFilePath(produces) {
      if (!produces || !produces.trim()) return false;
      return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
    }
    function runSyncStatus2(cwd) {
      const planningDir = join(cwd, ".planning");
      if (!existsSync(planningDir)) {
        return { error: "No Declare project found. Run /declare:init first." };
      }
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag, milestones, declarations } = graphResult;
      const actionResults = [];
      const milestoneResults = [];
      const declarationResults = [];
      for (const m of milestones) {
        const folderPath = findMilestoneFolder(planningDir, m.id);
        if (!folderPath) continue;
        const planPath = join(folderPath, "PLAN.md");
        if (!existsSync(planPath)) continue;
        let planContent = readFileSync(planPath, "utf-8");
        const { actions } = parsePlanFile(planContent);
        let planDirty = false;
        const milestoneAlreadyDone = isCompleted(m.status);
        for (const action of actions) {
          if (isCompleted(action.status)) {
            actionResults.push({ id: action.id, milestone: m.id, changed: false, reason: "already DONE" });
            continue;
          }
          const summaryPath = join(folderPath, `${action.id}-SUMMARY.md`);
          if (existsSync(summaryPath)) {
            planContent = updateActionStatus(planContent, action.id, "DONE");
            planDirty = true;
            actionResults.push({ id: action.id, milestone: m.id, changed: true, reason: "SUMMARY.md exists" });
            continue;
          }
          if (milestoneAlreadyDone) {
            planContent = updateActionStatus(planContent, action.id, "DONE");
            planDirty = true;
            actionResults.push({ id: action.id, milestone: m.id, changed: true, reason: `milestone ${m.id} is DONE` });
            continue;
          }
          const produces = action.produces || "";
          if (looksLikeFilePath(produces)) {
            const filePath = resolve(cwd, produces);
            if (existsSync(filePath)) {
              planContent = updateActionStatus(planContent, action.id, "DONE");
              planDirty = true;
              actionResults.push({ id: action.id, milestone: m.id, changed: true, reason: `produces exists: ${produces}` });
            } else {
              actionResults.push({ id: action.id, milestone: m.id, changed: false, reason: `produces missing: ${produces}` });
            }
          } else {
            actionResults.push({ id: action.id, milestone: m.id, changed: false, reason: "no verifiable produces path" });
          }
        }
        if (planDirty) {
          writeFileSync(planPath, planContent, "utf-8");
        }
      }
      const { actions: freshActions } = loadActionsFromFolders(planningDir);
      const milestoneActionIds = /* @__PURE__ */ new Map();
      const actionStatusMap = /* @__PURE__ */ new Map();
      for (const a of freshActions) {
        actionStatusMap.set(a.id, a.status);
        for (const mid of a.causes) {
          if (!milestoneActionIds.has(mid)) milestoneActionIds.set(mid, []);
          milestoneActionIds.get(mid).push(a.id);
        }
      }
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const { milestones: parsedMilestones } = parseMilestonesFile(milestonesContent);
      let milestonesDirty = false;
      const updatedMilestones = parsedMilestones.map((m) => {
        if (isCompleted(m.status)) {
          milestoneResults.push({ id: m.id, changed: false, reason: "already DONE" });
          return m;
        }
        const actionIds = milestoneActionIds.get(m.id) || [];
        if (actionIds.length === 0) {
          milestoneResults.push({ id: m.id, changed: false, reason: "no actions found" });
          return m;
        }
        const allDone = actionIds.every((aid) => isCompleted(actionStatusMap.get(aid) || "PENDING"));
        if (allDone) {
          milestonesDirty = true;
          milestoneResults.push({ id: m.id, changed: true, reason: `all ${actionIds.length} actions DONE` });
          return { ...m, status: "DONE" };
        } else {
          const doneCount = actionIds.filter((aid) => isCompleted(actionStatusMap.get(aid) || "PENDING")).length;
          milestoneResults.push({ id: m.id, changed: false, reason: `${doneCount}/${actionIds.length} actions DONE` });
          return m;
        }
      });
      if (milestonesDirty) {
        const projectNameMatch = milestonesContent.match(/^# Milestones:\s*(.+)/m);
        const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Project";
        writeFileSync(milestonesPath, writeMilestonesFile(updatedMilestones, projectName), "utf-8");
      }
      const futurePath = join(planningDir, "FUTURE.md");
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const parsedDeclarations = parseFutureFile(futureContent);
      const milestoneStatusMap = new Map(updatedMilestones.map((m) => [m.id, m.status]));
      let futureDirty = false;
      const updatedDeclarations = parsedDeclarations.map((d) => {
        if (isCompleted(d.status)) {
          declarationResults.push({ id: d.id, changed: false, reason: "already DONE" });
          return d;
        }
        const realizingMilestones = updatedMilestones.filter((m) => m.realizes.includes(d.id));
        if (realizingMilestones.length === 0) {
          declarationResults.push({ id: d.id, changed: false, reason: "no milestones realize this declaration" });
          return d;
        }
        const allDone = realizingMilestones.every((m) => isCompleted(milestoneStatusMap.get(m.id) || "PENDING"));
        if (allDone) {
          futureDirty = true;
          declarationResults.push({ id: d.id, changed: true, reason: `all ${realizingMilestones.length} milestones DONE` });
          return { ...d, status: "DONE" };
        } else {
          const doneCount = realizingMilestones.filter((m) => isCompleted(milestoneStatusMap.get(m.id) || "PENDING")).length;
          declarationResults.push({ id: d.id, changed: false, reason: `${doneCount}/${realizingMilestones.length} milestones DONE` });
          return d;
        }
      });
      if (futureDirty) {
        const projectNameMatch = futureContent.match(/^# Future:\s*(.+)/m);
        const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Project";
        writeFileSync(futurePath, writeFutureFile(updatedDeclarations, projectName), "utf-8");
      }
      const actionsDone = actionResults.filter((r) => r.changed).length;
      const msDone = milestoneResults.filter((r) => r.changed).length;
      const declsDone = declarationResults.filter((r) => r.changed).length;
      const summary = [
        `Actions marked DONE: ${actionsDone}/${actionResults.length}`,
        `Milestones marked DONE: ${msDone}/${milestoneResults.length}`,
        `Declarations marked DONE: ${declsDone}/${declarationResults.length}`
      ].join(" | ");
      return { actions: actionResults, milestones: milestoneResults, declarations: declarationResults, summary };
    }
    module2.exports = { runSyncStatus: runSyncStatus2 };
  }
});

// src/commands/get-exec-plan.js
var require_get_exec_plan = __commonJS({
  "src/commands/get-exec-plan.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, readdirSync } = require("node:fs");
    var { join } = require("node:path");
    var { execSync } = require("node:child_process");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { findMilestoneFolder } = require_milestone_folders();
    function parseFrontmatter(fmText) {
      const result = {};
      const lines = fmText.split("\n");
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        const keyMatch = line.match(/^(\w[\w_]*):\s*(.*)/);
        if (!keyMatch) {
          i++;
          continue;
        }
        const [, key, rest] = keyMatch;
        if (rest.trim() === "") {
          const children = [];
          i++;
          while (i < lines.length && (lines[i].startsWith("  ") || lines[i].trim() === "")) {
            const child = lines[i];
            const listItem = child.match(/^\s+-\s+(.*)/);
            const nestedKey = child.match(/^\s+(\w[\w_]*):\s*(.*)/);
            if (listItem) {
              children.push({ type: "item", value: listItem[1].replace(/^["']|["']$/g, "") });
            } else if (nestedKey) {
              children.push({ type: "key", key: nestedKey[1], value: nestedKey[2] });
            }
            i++;
          }
          if (children.length > 0 && children[0].type === "item") {
            result[key] = children.map((c) => c.value);
          } else if (children.length > 0 && children[0].type === "key") {
            result[key] = {};
            let subKey = null;
            let subItems = [];
            for (const c of children) {
              if (c.type === "key") {
                if (subKey) result[key][subKey] = subItems;
                subKey = c.key;
                subItems = c.value.trim() ? [c.value.replace(/^["']|["']$/g, "")] : [];
              } else if (c.type === "item") {
                subItems.push(c.value);
              }
            }
            if (subKey) result[key][subKey] = subItems;
          }
        } else {
          result[key] = rest.trim().replace(/^["']|["']$/g, "");
          i++;
        }
      }
      return result;
    }
    function extractTag(content, tag) {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
      const m = content.match(re);
      return m ? m[1].trim() : null;
    }
    function parseTasks(tasksContent) {
      const tasks = [];
      const taskRe = /<task([^>]*)>([\s\S]*?)<\/task>/gi;
      let m;
      while ((m = taskRe.exec(tasksContent)) !== null) {
        const attrs = m[1];
        const body = m[2];
        const typeMatch = attrs.match(/type="([^"]+)"/);
        const taskType = typeMatch ? typeMatch[1] : "auto";
        tasks.push({
          type: taskType,
          name: extractTag(body, "name") || "",
          action: extractTag(body, "action"),
          verify: extractTag(body, "verify"),
          done: extractTag(body, "done"),
          howToVerify: extractTag(body, "how-to-verify"),
          resumeSignal: extractTag(body, "resume-signal"),
          whatBuilt: extractTag(body, "what-built")
        });
      }
      return tasks;
    }
    function findExecPlan(milestoneFolder, actionId) {
      if (!existsSync(milestoneFolder)) return null;
      const entries = readdirSync(milestoneFolder);
      const match = entries.find(
        (f) => f.toUpperCase().startsWith(actionId.toUpperCase() + "-EXEC-PLAN") || f.toUpperCase().startsWith("EXEC-PLAN-" + actionId.replace(/^A-/, ""))
      );
      return match ? join(milestoneFolder, match) : null;
    }
    function resolveActionModel(cwd, summaryContent) {
      try {
        if (summaryContent) {
          const fmMatch = summaryContent.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const fm = parseFrontmatter(fmMatch[1]);
            if (fm.model) return String(fm.model);
          }
        }
        const configPath = join(cwd, ".planning", "config.json");
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          return config.modelAssignment?.executor ?? null;
        }
        return null;
      } catch {
        return null;
      }
    }
    function getActionCommits(cwd, actionId, milestoneId) {
      try {
        const milestonePrefix = milestoneId.match(/^(M-\d+)/);
        if (!milestonePrefix) return [];
        const grepPattern = `(${milestonePrefix[1]}-${actionId})`;
        const output = execSync(
          `git log --all --oneline --format="%H|%s|%ai" --extended-regexp --grep="${grepPattern}"`,
          { cwd, encoding: "utf-8", timeout: 5e3 }
        );
        const lines = output.trim().split("\n").filter(Boolean);
        return lines.map((line) => {
          const [sha, message, date] = line.split("|");
          return {
            sha: sha || "",
            shortSha: (sha || "").slice(0, 7),
            message: message || "",
            date: date || ""
          };
        });
      } catch {
        return [];
      }
    }
    function runGetExecPlan2(cwd, args) {
      const actionId = parseFlag(args, "action");
      if (!actionId) {
        return { error: "Missing --action flag. Usage: get-exec-plan --action A-XX" };
      }
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const action = dag.getNode(actionId);
      if (!action) return { error: `Action not found: ${actionId}` };
      const upstreamMilestones = dag.getUpstream(actionId).filter((n) => n.type === "milestone");
      if (upstreamMilestones.length === 0) return { error: `No milestone found for action ${actionId}` };
      const milestone = upstreamMilestones[0];
      const planningDir = join(cwd, ".planning");
      const milestoneFolder = findMilestoneFolder(planningDir, milestone.id);
      if (!milestoneFolder) {
        return { error: `Milestone folder not found for ${milestone.id}` };
      }
      const commits = getActionCommits(cwd, actionId, milestone.id);
      const execPlanPath = findExecPlan(milestoneFolder, actionId);
      if (!execPlanPath) {
        return {
          actionId,
          actionTitle: action.title,
          status: action.status,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          execPlan: null,
          summaryExists: false,
          model: resolveActionModel(cwd, null),
          commits
        };
      }
      const raw = readFileSync(execPlanPath, "utf-8");
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      const frontmatter = fmMatch ? parseFrontmatter(fmMatch[1]) : {};
      const objective = extractTag(raw, "objective");
      const tasksRaw = extractTag(raw, "tasks");
      const tasks = tasksRaw ? parseTasks(tasksRaw) : [];
      const successCriteria = extractTag(raw, "success_criteria");
      const verification = extractTag(raw, "verification");
      const summaryPath = join(milestoneFolder, `${actionId}-SUMMARY.md`);
      const summaryExists = existsSync(summaryPath);
      const summaryContent = summaryExists ? readFileSync(summaryPath, "utf-8") : null;
      const model = resolveActionModel(cwd, summaryContent);
      return {
        actionId,
        actionTitle: action.title,
        status: action.status,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        model,
        execPlan: {
          wave: frontmatter.wave ? Number(frontmatter.wave) : null,
          autonomous: frontmatter.autonomous === "true" || frontmatter.autonomous === true,
          dependsOn: Array.isArray(frontmatter.depends_on) ? frontmatter.depends_on : [],
          filesModified: Array.isArray(frontmatter.files_modified) ? frontmatter.files_modified : [],
          declarations: Array.isArray(frontmatter.declarations) ? frontmatter.declarations : [],
          mustHaves: frontmatter.must_haves || null,
          objective,
          tasks,
          successCriteria,
          verification
        },
        summaryExists,
        summaryContent,
        commits
      };
    }
    module2.exports = { runGetExecPlan: runGetExecPlan2 };
  }
});

// src/commands/quick-task.js
var require_quick_task = __commonJS({
  "src/commands/quick-task.js"(exports2, module2) {
    "use strict";
    var { existsSync, mkdirSync, writeFileSync, readdirSync } = require("node:fs");
    var { join } = require("node:path");
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function slugify(text) {
      return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 40);
    }
    function nextQuickNumber(quickDir) {
      if (!existsSync(quickDir)) return "001";
      const entries = readdirSync(quickDir, { withFileTypes: true });
      let max = 0;
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const match = entry.name.match(/^(\d{3})-/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > max) max = n;
        }
      }
      return String(max + 1).padStart(3, "0");
    }
    function runQuickTask2(cwd, args) {
      const description = parseFlag(args, "description");
      const slugOverride = parseFlag(args, "slug");
      if (!description) {
        return { error: "Missing required flag: --description" };
      }
      const quickDir = join(cwd, ".planning", "quick");
      if (!existsSync(quickDir)) {
        mkdirSync(quickDir, { recursive: true });
      }
      const num = nextQuickNumber(quickDir);
      const slug = slugOverride ? slugify(slugOverride) : slugify(description);
      const folderName = `${num}-${slug}`;
      const folderPath = join(quickDir, folderName);
      const planPath = join(folderPath, "QUICK-PLAN.md");
      const relFolderPath = `.planning/quick/${folderName}`;
      const relPlanPath = `${relFolderPath}/QUICK-PLAN.md`;
      mkdirSync(folderPath, { recursive: true });
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const content = [
        `# Quick Task ${num}: ${description}`,
        "",
        `**ID:** ${num}`,
        `**Created:** ${today}`,
        `**Status:** PENDING`,
        "",
        "## Description",
        "",
        description,
        "",
        "## Tasks",
        "",
        "- [ ] <!-- Add tasks here -->",
        "",
        "## Notes",
        "",
        "<!-- Add notes as you work -->",
        ""
      ].join("\n");
      writeFileSync(planPath, content, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: add quick task ${num} "${description}"`,
          [relPlanPath]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return {
        id: num,
        folder: relFolderPath,
        planPath: relPlanPath,
        committed,
        hash
      };
    }
    module2.exports = { runQuickTask: runQuickTask2 };
  }
});

// src/commands/todo.js
var require_todo = __commonJS({
  "src/commands/todo.js"(exports2, module2) {
    "use strict";
    var {
      existsSync,
      mkdirSync,
      writeFileSync,
      readFileSync,
      readdirSync,
      renameSync
    } = require("node:fs");
    var { join, basename } = require("node:path");
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function slugify(text) {
      return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 40);
    }
    function nextTodoNumber(todosDir) {
      if (!existsSync(todosDir)) return "001";
      const entries = readdirSync(todosDir, { withFileTypes: true });
      let max = 0;
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const match = entry.name.match(/^(\d{3})-/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > max) max = n;
        }
      }
      const completedDir = join(todosDir, "completed");
      if (existsSync(completedDir)) {
        const completed = readdirSync(completedDir, { withFileTypes: true });
        for (const entry of completed) {
          if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
          const match = entry.name.match(/^(\d{3})-/);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > max) max = n;
          }
        }
      }
      return String(max + 1).padStart(3, "0");
    }
    function parseTodoFile(content) {
      const lines = content.split("\n");
      let description = "";
      let created = "";
      if (lines[0] === "---") {
        let i = 1;
        while (i < lines.length && lines[i] !== "---") {
          const createdMatch = lines[i].match(/^created:\s*(.+)$/);
          if (createdMatch) created = createdMatch[1].trim();
          i++;
        }
      }
      for (const line of lines) {
        const h1Match = line.match(/^#\s+(.+)$/);
        if (h1Match) {
          description = h1Match[1].trim();
          break;
        }
      }
      return { description, created };
    }
    function runAddTodo2(cwd, args) {
      const description = parseFlag(args, "description");
      if (!description) {
        return { error: "Missing required flag: --description" };
      }
      const todosDir = join(cwd, ".planning", "todos");
      if (!existsSync(todosDir)) {
        mkdirSync(todosDir, { recursive: true });
      }
      const num = nextTodoNumber(todosDir);
      const slug = slugify(description);
      const fileName = `${num}-${slug}.md`;
      const filePath = join(todosDir, fileName);
      const relPath = `.planning/todos/${fileName}`;
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const content = [
        "---",
        `created: ${today}`,
        "status: pending",
        "---",
        "",
        `# ${description}`,
        "",
        "## Notes",
        "",
        "<!-- Add context and notes here -->",
        ""
      ].join("\n");
      writeFileSync(filePath, content, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: add todo ${num} "${description}"`,
          [relPath]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return {
        id: num,
        path: relPath,
        committed,
        hash
      };
    }
    function runCheckTodos2(cwd) {
      const todosDir = join(cwd, ".planning", "todos");
      if (!existsSync(todosDir)) {
        return { todos: [] };
      }
      const entries = readdirSync(todosDir, { withFileTypes: true });
      const todos = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const match = entry.name.match(/^(\d{3})-/);
        if (!match) continue;
        const id = match[1];
        const filePath = join(todosDir, entry.name);
        const relPath = `.planning/todos/${entry.name}`;
        let content = "";
        try {
          content = readFileSync(filePath, "utf-8");
        } catch {
          continue;
        }
        const { description, created } = parseTodoFile(content);
        todos.push({
          id,
          description: description || entry.name.replace(/^\d{3}-/, "").replace(/\.md$/, "").replace(/-/g, " "),
          created: created || "",
          path: relPath
        });
      }
      todos.sort((a, b) => a.id.localeCompare(b.id));
      return { todos };
    }
    function runCompleteTodo2(cwd, args) {
      const id = parseFlag(args, "id");
      if (!id) {
        return { error: "Missing required flag: --id" };
      }
      const todosDir = join(cwd, ".planning", "todos");
      if (!existsSync(todosDir)) {
        return { error: `No todos directory found at .planning/todos/` };
      }
      const entries = readdirSync(todosDir, { withFileTypes: true });
      let todoFile = null;
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        if (entry.name.startsWith(`${id}-`) || entry.name === `${id}.md`) {
          todoFile = entry.name;
          break;
        }
      }
      if (!todoFile) {
        return { error: `Todo with ID ${id} not found in .planning/todos/` };
      }
      const completedDir = join(todosDir, "completed");
      if (!existsSync(completedDir)) {
        mkdirSync(completedDir, { recursive: true });
      }
      const fromPath = join(todosDir, todoFile);
      const toPath = join(completedDir, todoFile);
      const relFrom = `.planning/todos/${todoFile}`;
      const relTo = `.planning/todos/completed/${todoFile}`;
      renameSync(fromPath, toPath);
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: complete todo ${id}`,
          [relTo]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return {
        id,
        from: relFrom,
        to: relTo,
        committed,
        hash
      };
    }
    module2.exports = { runAddTodo: runAddTodo2, runCheckTodos: runCheckTodos2, runCompleteTodo: runCompleteTodo2 };
  }
});

// src/commands/config-get.js
var require_config_get = __commonJS({
  "src/commands/config-get.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync } = require("node:fs");
    var { join } = require("node:path");
    function getAtPath(obj, path) {
      const parts = path.split(".");
      let current = obj;
      for (const part of parts) {
        if (current === null || typeof current !== "object") {
          return { found: false, value: void 0 };
        }
        const record = (
          /** @type {Record<string, unknown>} */
          current
        );
        if (!(part in record)) {
          return { found: false, value: void 0 };
        }
        current = record[part];
      }
      return { found: true, value: current };
    }
    function runConfigGet2(cwd, args) {
      const keyPath = args && args[0];
      if (!keyPath) {
        return { error: 'config-get requires a key path argument (e.g., "workflow.research")' };
      }
      const configPath = join(cwd, ".planning", "config.json");
      if (!existsSync(configPath)) {
        return { error: "No config.json found. Run /declare:init to initialize the project." };
      }
      let config;
      try {
        config = JSON.parse(readFileSync(configPath, "utf-8"));
      } catch (err) {
        return { error: `Failed to parse config.json: ${err.message}` };
      }
      const { found, value } = getAtPath(config, keyPath);
      if (!found) {
        return { error: `Key not found: ${keyPath}` };
      }
      return { key: keyPath, value };
    }
    module2.exports = { runConfigGet: runConfigGet2 };
  }
});

// src/commands/config-set.js
var require_config_set = __commonJS({
  "src/commands/config-set.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync } = require("node:fs");
    var { join } = require("node:path");
    function parseValue(raw) {
      if (raw === "true") return true;
      if (raw === "false") return false;
      const num = Number(raw);
      if (!Number.isNaN(num) && raw.trim() !== "") return num;
      return raw;
    }
    function setAtPath(obj, path, value) {
      const parts = path.split(".");
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] === null || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = /** @type {Record<string, unknown>} */
        current[part];
      }
      current[parts[parts.length - 1]] = value;
    }
    function parseKeyValueFlags(argv) {
      let key = null;
      let value = null;
      for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--key" && i + 1 < argv.length) {
          key = argv[i + 1];
          i++;
        } else if (argv[i] === "--value" && i + 1 < argv.length) {
          value = argv[i + 1];
          i++;
        }
      }
      return { key, value };
    }
    function runConfigSet2(cwd, args) {
      const { key: keyPath, value: rawValue } = parseKeyValueFlags(args);
      if (!keyPath) {
        return { error: "config-set requires --key <path.to.key>" };
      }
      if (rawValue === null) {
        return { error: "config-set requires --value <value>" };
      }
      const configPath = join(cwd, ".planning", "config.json");
      if (!existsSync(configPath)) {
        return { error: "No config.json found. Run /declare:init to initialize the project." };
      }
      let config;
      try {
        config = JSON.parse(readFileSync(configPath, "utf-8"));
      } catch (err) {
        return { error: `Failed to parse config.json: ${err.message}` };
      }
      const parsedValue = parseValue(rawValue);
      setAtPath(config, keyPath, parsedValue);
      try {
        writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      } catch (err) {
        return { error: `Failed to write config.json: ${err.message}` };
      }
      return { key: keyPath, value: parsedValue, updated: true };
    }
    module2.exports = { runConfigSet: runConfigSet2 };
  }
});

// src/commands/health-check.js
var require_health_check = __commonJS({
  "src/commands/health-check.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, readdirSync, mkdirSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFutureFile } = require_future();
    var { parseMilestonesFile } = require_milestones();
    var { findMilestoneFolder, ensureMilestoneFolder } = require_milestone_folders();
    function runHealthCheck2(cwd) {
      const planningDir = join(cwd, ".planning");
      const milestonesDir = join(planningDir, "milestones");
      if (!existsSync(planningDir)) {
        return { error: "No .planning/ directory found. Run /declare:init to initialize the project." };
      }
      const issues = [];
      const futurePath = join(planningDir, "FUTURE.md");
      let declarations = [];
      if (!existsSync(futurePath)) {
        issues.push({
          type: "missing_file",
          message: "FUTURE.md is missing",
          path: ".planning/FUTURE.md",
          fixable: false
        });
      } else {
        try {
          const content = readFileSync(futurePath, "utf-8");
          declarations = parseFutureFile(content);
        } catch (err) {
          issues.push({
            type: "parse_error",
            message: `FUTURE.md could not be parsed: ${err.message}`,
            path: ".planning/FUTURE.md",
            fixable: false
          });
        }
      }
      const milestonesPath = join(planningDir, "MILESTONES.md");
      let milestones = [];
      if (!existsSync(milestonesPath)) {
        issues.push({
          type: "missing_file",
          message: "MILESTONES.md is missing",
          path: ".planning/MILESTONES.md",
          fixable: false
        });
      } else {
        try {
          const content = readFileSync(milestonesPath, "utf-8");
          const parsed = parseMilestonesFile(content);
          milestones = parsed.milestones;
        } catch (err) {
          issues.push({
            type: "parse_error",
            message: `MILESTONES.md could not be parsed: ${err.message}`,
            path: ".planning/MILESTONES.md",
            fixable: false
          });
        }
      }
      const configPath = join(planningDir, "config.json");
      if (!existsSync(configPath)) {
        issues.push({
          type: "missing_file",
          message: "config.json is missing",
          path: ".planning/config.json",
          fixable: false
        });
      } else {
        try {
          JSON.parse(readFileSync(configPath, "utf-8"));
        } catch (err) {
          issues.push({
            type: "parse_error",
            message: `config.json could not be parsed: ${err.message}`,
            path: ".planning/config.json",
            fixable: false
          });
        }
      }
      if (milestones.length > 0) {
        for (const milestone of milestones) {
          const folder = findMilestoneFolder(planningDir, milestone.id);
          if (!folder) {
            issues.push({
              type: "missing_folder",
              message: `Milestone ${milestone.id} ("${milestone.title}") has no folder in .planning/milestones/`,
              path: `.planning/milestones/${milestone.id}-*`,
              fixable: true,
              // Store data needed for repair
              _milestoneId: milestone.id,
              _milestoneTitle: milestone.title
            });
          }
        }
      }
      if (existsSync(milestonesDir)) {
        let entries;
        try {
          entries = readdirSync(milestonesDir, { withFileTypes: true });
        } catch {
          entries = [];
        }
        const referencedIds = new Set(milestones.map((m) => m.id));
        const milestoneIdPattern = /^(M-\d+)/;
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith("_")) continue;
          const match = entry.name.match(milestoneIdPattern);
          if (!match) continue;
          const folderId = match[1];
          if (!referencedIds.has(folderId)) {
            issues.push({
              type: "orphaned_folder",
              message: `Folder "${entry.name}" has no corresponding milestone in MILESTONES.md`,
              path: `.planning/milestones/${entry.name}`,
              fixable: false
            });
          }
        }
      }
      return {
        healthy: issues.length === 0,
        issues
      };
    }
    function runHealthCheckRepair2(cwd) {
      const planningDir = join(cwd, ".planning");
      const result = runHealthCheck2(cwd);
      if (result.error) return result;
      const repaired = [];
      for (const issue of result.issues) {
        if (!issue.fixable) continue;
        if (issue.type === "missing_folder" && issue._milestoneId && issue._milestoneTitle) {
          try {
            ensureMilestoneFolder(planningDir, issue._milestoneId, issue._milestoneTitle);
            repaired.push(`Created folder for ${issue._milestoneId}: ${issue._milestoneTitle}`);
          } catch (err) {
          }
        }
      }
      const recheck = runHealthCheck2(cwd);
      if (recheck.error) return recheck;
      return {
        healthy: recheck.healthy,
        issues: recheck.issues,
        repaired
      };
    }
    module2.exports = { runHealthCheck: runHealthCheck2, runHealthCheckRepair: runHealthCheckRepair2 };
  }
});

// src/server/ai-runner.js
var require_ai_runner = __commonJS({
  "src/server/ai-runner.js"(exports2, module2) {
    "use strict";
    var _query;
    async function getQuery() {
      if (!_query) {
        const sdk = await import("@anthropic-ai/claude-agent-sdk");
        _query = sdk.query;
      }
      return _query;
    }
    async function runAI(prompt, opts = {}) {
      const queryFn = await getQuery();
      const abortController = opts.abortController || new AbortController();
      const timeoutMs = opts.withTools || opts.allowedTools ? 10 * 60 * 1e3 : 2 * 60 * 1e3;
      const timeoutId = setTimeout(() => {
        if (!abortController.signal.aborted) abortController.abort();
      }, timeoutMs);
      const savedClaudeCode = process.env.CLAUDECODE;
      delete process.env.CLAUDECODE;
      try {
        const env = { ...process.env };
        delete env.CLAUDECODE;
        const queryOpts = {
          model: opts.model || "haiku",
          maxTurns: opts.maxTurns || 1,
          cwd: opts.cwd || process.cwd(),
          abortController,
          env,
          systemPrompt: opts.systemPrompt || "You are a helpful assistant. Respond concisely and directly."
        };
        if (opts.withTools || opts.allowedTools) {
          queryOpts.allowedTools = opts.allowedTools || ["Read", "Write", "Edit", "Bash", "Glob", "Grep"];
          queryOpts.permissionMode = "bypassPermissions";
          if (!opts.maxTurns) queryOpts.maxTurns = 10;
        } else {
          queryOpts.tools = [];
        }
        const conversation = queryFn({
          prompt,
          options: queryOpts
        });
        let resultText = "";
        for await (const message of conversation) {
          if (message.type === "assistant") {
            const content = message.message?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "text" && block.text) {
                  resultText += block.text;
                  if (opts.onText) opts.onText(block.text);
                }
              }
            }
          } else if (message.type === "result") {
            if (message.subtype === "success" && message.result) {
              resultText = message.result;
            } else if (message.is_error) {
              const errDetail = message.errors?.join(", ") || message.error || JSON.stringify(message);
              console.error("[ai-runner] SDK error result:", errDetail);
              return { text: "", error: errDetail || "AI query failed" };
            }
          }
        }
        return { text: resultText };
      } catch (err) {
        console.error("[ai-runner] Exception:", err.message || err);
        if (abortController.signal.aborted) {
          return { text: "", error: "Cancelled" };
        }
        return { text: "", error: String(err.message || err) };
      } finally {
        clearTimeout(timeoutId);
        if (savedClaudeCode) process.env.CLAUDECODE = savedClaudeCode;
      }
    }
    module2.exports = { runAI };
  }
});

// src/server/process-manager.js
var require_process_manager = __commonJS({
  "src/server/process-manager.js"(exports2, module2) {
    "use strict";
    var { runAI } = require_ai_runner();
    var fs = require("node:fs");
    var path = require("node:path");
    var { findMilestoneFolder } = require_milestone_folders();
    function appendLog(logPath, line) {
      if (!logPath) return;
      try {
        fs.appendFileSync(logPath, line + "\n", "utf-8");
      } catch (_) {
      }
    }
    function buildExecutionPrompt(actionId, milestoneId, ctx) {
      if (!ctx) {
        return `Run /declare:execute ${milestoneId} for action ${actionId} only. Do not ask questions, execute autonomously.`;
      }
      const lines = [
        `Execute action ${actionId} for milestone ${milestoneId}. Work autonomously \u2014 do not ask questions.`,
        ""
      ];
      if (ctx.declaration) {
        lines.push(`## Declaration: ${ctx.declaration.id}`);
        lines.push(ctx.declaration.statement);
        lines.push("");
      }
      if (ctx.milestone) {
        lines.push(`## Milestone: ${ctx.milestone.id} \u2014 ${ctx.milestone.title}`);
        if (ctx.milestone.description) {
          lines.push(ctx.milestone.description);
        }
        lines.push("");
      }
      lines.push(`## Action: ${ctx.action.id} \u2014 ${ctx.action.title}`);
      if (ctx.action.produces) {
        lines.push(`**Produces:** ${ctx.action.produces}`);
      }
      lines.push("");
      if (ctx.siblingActions.length > 0) {
        lines.push("## Other actions for this milestone (do NOT do these, just for context):");
        for (const s of ctx.siblingActions) {
          const statusMark = s.status === "DONE" ? " [DONE]" : "";
          lines.push(`- ${s.id}: ${s.title}${s.produces ? " (produces: " + s.produces + ")" : ""}${statusMark}`);
        }
        lines.push("");
      }
      lines.push("## Instructions");
      lines.push("1. Read the project context files: .planning/FUTURE.md, .planning/MILESTONES.md, .planning/STATE.md");
      lines.push('2. Understand what this action needs to deliver based on the "Produces" field above');
      lines.push("3. Explore the codebase to find the right files to modify");
      lines.push("4. Implement the changes \u2014 write real, working code");
      lines.push("5. Verify your changes work (run relevant tests, check for errors)");
      lines.push("6. Commit your changes with a descriptive message");
      return lines.join("\n");
    }
    function createProcessManager(sseClients, cwd, registry) {
      const processes = /* @__PURE__ */ new Map();
      function broadcast(event, data) {
        const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
        for (const client of sseClients) {
          try {
            client.write(payload);
          } catch (_) {
            sseClients.delete(client);
          }
        }
      }
      function execute(actionId, milestoneId, ctx) {
        if (processes.size > 0) {
          return { error: "busy", status: 409 };
        }
        if (processes.has(actionId)) {
          return { error: "already_running", status: 409 };
        }
        const prompt = buildExecutionPrompt(actionId, milestoneId, ctx);
        const planningDir = path.join(cwd, ".planning");
        const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
        let logPath;
        if (milestoneFolder) {
          logPath = path.join(milestoneFolder, "execution.log");
        } else {
          process.stderr.write(`[declare] Warning: milestone folder not found for ${milestoneId}, skipping execution log
`);
        }
        const abortController = new AbortController();
        let agentId;
        if (registry) {
          const agent = registry.spawn("execution", actionId, milestoneId);
          agentId = agent.id;
        }
        processes.set(actionId, { abortController, milestoneId, logPath, agentId });
        appendLog(logPath, `
=== START ${actionId} @ ${(/* @__PURE__ */ new Date()).toISOString()} ===`);
        runAI(prompt, {
          cwd,
          model: "sonnet",
          withTools: true,
          maxTurns: 10,
          abortController,
          onText: (chunk) => {
            broadcast("action-output", { actionId, text: chunk, stream: "stdout" });
            appendLog(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] [${actionId}] [stdout] ${chunk}`);
          }
        }).then(({ text, error }) => {
          const entry = processes.get(actionId);
          const entryAgentId = entry?.agentId;
          const exitCode = error ? 1 : 0;
          appendLog(entry?.logPath, `=== END ${actionId} @ ${(/* @__PURE__ */ new Date()).toISOString()} exit=${exitCode} ===
`);
          processes.delete(actionId);
          broadcast("action-complete", { actionId, exitCode });
          if (registry && entryAgentId) {
            if (exitCode === 0) {
              const mFolder = entry?.logPath ? path.dirname(entry.logPath) : null;
              registry.complete(entryAgentId, {
                actionId,
                milestoneId: entry?.milestoneId || milestoneId,
                summaryPath: mFolder ? path.join(mFolder, actionId + "-SUMMARY.md") : null,
                logPath: entry?.logPath || null
              });
            } else {
              registry.fail(entryAgentId, exitCode, error || "execution failed");
            }
          }
        }).catch((err) => {
          const entry = processes.get(actionId);
          const entryAgentId = entry?.agentId;
          appendLog(entry?.logPath, `=== ERROR ${actionId} @ ${(/* @__PURE__ */ new Date()).toISOString()} ===
`);
          processes.delete(actionId);
          broadcast("action-complete", { actionId, exitCode: -1 });
          if (registry && entryAgentId) {
            registry.fail(entryAgentId, -1, String(err.message || err));
          }
        });
        return { ok: true };
      }
      function stop(actionId) {
        const entry = processes.get(actionId);
        if (!entry) {
          return { error: "not_running", status: 404 };
        }
        entry.abortController.abort();
        return { ok: true };
      }
      function running() {
        return [...processes.keys()];
      }
      return { execute, stop, running };
    }
    module2.exports = { createProcessManager };
  }
});

// src/server/derivation-runner.js
var require_derivation_runner = __commonJS({
  "src/server/derivation-runner.js"(exports2, module2) {
    "use strict";
    var { runAI } = require_ai_runner();
    function buildPrompt(declarationId, declarations) {
      let targets;
      if (declarationId) {
        targets = declarations.filter((d) => d.id === declarationId);
      } else {
        targets = declarations.filter(
          (d) => !d.milestones || d.milestones.length === 0
        );
      }
      const formatted = targets.map((d) => `- ${d.id}: ${d.statement}`).join("\n");
      return 'You are deriving milestones for a Declare project. Given these declarations, propose 2-4 milestones per declaration by asking "For this to be true, what must be true?" Each milestone needs a concise title AND a detailed description explaining what it delivers, its scope, and success criteria. Output ONLY a JSON array with no markdown fencing: [{"title": "short milestone title", "description": "Detailed description of what this milestone delivers, its scope and boundaries, and how to verify it is complete.", "realizes": "D-XX", "reason": "why this must be true"}]. Declarations:\n\n' + formatted;
    }
    function createDerivationRunner(sseClients, cwd, registry) {
      const sessions = /* @__PURE__ */ new Map();
      function broadcast(event, data) {
        const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
        for (const client of sseClients) {
          try {
            client.write(payload);
          } catch (_) {
            sseClients.delete(client);
          }
        }
      }
      function derive(declarationId, declarations) {
        const sessionId = `deriv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const prompt = buildPrompt(declarationId, declarations);
        const abortController = new AbortController();
        let agentId;
        if (registry) {
          const agent = registry.spawn("derivation", declarationId || "all", "");
          agentId = agent.id;
        }
        sessions.set(sessionId, { abortController, agentId, declarationId, startTime: Date.now() });
        broadcast("derivation-output", {
          sessionId,
          declarationId,
          text: "Spawning AI agent\u2026",
          stream: "status"
        });
        runAI(prompt, {
          cwd,
          model: "sonnet",
          maxTurns: 1,
          abortController,
          onText: (chunk) => {
            broadcast("derivation-output", {
              sessionId,
              declarationId,
              text: chunk,
              stream: "stdout"
            });
          }
        }).then(({ text, error }) => {
          const session = sessions.get(sessionId);
          const closingAgentId = session ? session.agentId : void 0;
          sessions.delete(sessionId);
          if (error) {
            broadcast("derivation-complete", {
              sessionId,
              declarationId,
              exitCode: 1,
              milestones: null,
              error
            });
            if (registry && closingAgentId) {
              registry.fail(closingAgentId, 1, error);
            }
            return;
          }
          let milestones = null;
          try {
            milestones = JSON.parse(text.trim());
          } catch (_) {
            const match = text.match(/\[[\s\S]*\]/);
            if (match) {
              try {
                milestones = JSON.parse(match[0]);
              } catch (__) {
              }
            }
          }
          broadcast("derivation-complete", {
            sessionId,
            declarationId,
            exitCode: 0,
            milestones
          });
          if (registry && closingAgentId) {
            const milestoneIds = Array.isArray(milestones) ? milestones.map((m) => m.id || m.title || "unknown").filter(Boolean) : [];
            registry.complete(closingAgentId, { milestones: milestoneIds });
          }
        }).catch((err) => {
          const session = sessions.get(sessionId);
          const errorAgentId = session ? session.agentId : void 0;
          sessions.delete(sessionId);
          broadcast("derivation-complete", {
            sessionId,
            declarationId,
            exitCode: -1,
            milestones: null,
            error: String(err.message || err)
          });
          if (registry && errorAgentId) {
            registry.fail(errorAgentId, -1, "error");
          }
        });
        return { ok: true, sessionId };
      }
      function stop(sessionId) {
        if (sessionId) {
          const session = sessions.get(sessionId);
          if (!session) {
            return { error: "not_running", status: 404 };
          }
          session.abortController.abort();
          return { ok: true };
        }
        return stopAll();
      }
      function stopAll() {
        for (const [, session] of sessions) {
          session.abortController.abort();
        }
        return { ok: true };
      }
      function running() {
        if (sessions.size === 0) return null;
        return Array.from(sessions.entries()).map(([id, s]) => ({
          sessionId: id,
          declarationId: s.declarationId,
          startTime: s.startTime
        }));
      }
      return { derive, stop, stopAll, running };
    }
    module2.exports = { createDerivationRunner };
  }
});

// src/server/action-derivation-runner.js
var require_action_derivation_runner = __commonJS({
  "src/server/action-derivation-runner.js"(exports2, module2) {
    "use strict";
    var { runAI } = require_ai_runner();
    function buildActionPrompt(milestone, existingActions) {
      let prompt = `You are deriving actions for a Declare project milestone. An action is a concrete piece of work that causes (moves toward) a milestone. Given this milestone, propose 2-5 actions by asking "What work must be done to achieve this?" Output ONLY a JSON array with no markdown fencing: [{"title": "action title", "produces": "what this action delivers", "reason": "why this is needed"}]. 

Milestone:
- ${milestone.id}: ${milestone.title} (realizes: ${milestone.realizes.join(", ")})`;
      if (existingActions.length > 0) {
        prompt += "\n\nExisting actions for this milestone (do NOT duplicate these):\n";
        for (const a of existingActions) {
          prompt += `- ${a.id}: ${a.title}`;
          if (a.produces) prompt += ` (produces: ${a.produces})`;
          prompt += "\n";
        }
      }
      return prompt;
    }
    function createActionDerivationRunner(sseClients, cwd, registry) {
      const sessions = /* @__PURE__ */ new Map();
      function broadcast(event, data) {
        const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
        for (const client of sseClients) {
          try {
            client.write(payload);
          } catch (_) {
            sseClients.delete(client);
          }
        }
      }
      function derive(milestone, existingActions) {
        const sessionId = `action-deriv-${Date.now()}`;
        const prompt = buildActionPrompt(milestone, existingActions);
        const abortController = new AbortController();
        let agentId;
        if (registry) {
          const agent = registry.spawn("action-derivation", milestone.id, milestone.id);
          agentId = agent.id;
        }
        sessions.set(sessionId, { milestoneId: milestone.id, agentId, abortController, startTime: Date.now() });
        runAI(prompt, {
          cwd,
          model: "haiku",
          maxTurns: 1,
          abortController,
          onText: (text) => {
            broadcast("action-derivation-output", {
              sessionId,
              milestoneId: milestone.id,
              text,
              stream: "stdout"
            });
          }
        }).then(({ text, error }) => {
          const session = sessions.get(sessionId);
          const closingAgentId = session ? session.agentId : void 0;
          sessions.delete(sessionId);
          let actions = null;
          const exitCode = error ? 1 : 0;
          if (!error && text) {
            try {
              actions = JSON.parse(text.trim());
            } catch (_) {
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                try {
                  actions = JSON.parse(jsonMatch[0]);
                } catch (_2) {
                }
              }
            }
          }
          broadcast("action-derivation-complete", {
            sessionId,
            milestoneId: milestone.id,
            exitCode,
            actions
          });
          if (registry && closingAgentId) {
            if (exitCode === 0) {
              registry.complete(closingAgentId, {
                milestoneId: milestone.id,
                actionCount: Array.isArray(actions) ? actions.length : null
              });
            } else {
              registry.fail(closingAgentId, 1, error || "action derivation failed");
            }
          }
        }).catch((err) => {
          const session = sessions.get(sessionId);
          const closingAgentId = session ? session.agentId : void 0;
          sessions.delete(sessionId);
          broadcast("action-derivation-complete", { sessionId, milestoneId: milestone.id, exitCode: 1, actions: null });
          if (registry && closingAgentId) {
            registry.fail(closingAgentId, 1, String(err));
          }
        });
        return { ok: true, sessionId };
      }
      function stop(sessionId) {
        if (sessionId) {
          const session = sessions.get(sessionId);
          if (!session) {
            return { error: "not_running", status: 404 };
          }
          session.abortController.abort();
          return { ok: true };
        }
        return stopAll();
      }
      function stopAll() {
        for (const [, session] of sessions) {
          session.abortController.abort();
        }
        return { ok: true };
      }
      function running() {
        if (sessions.size === 0) return null;
        return Array.from(sessions.entries()).map(([id, s]) => ({
          sessionId: id,
          milestoneId: s.milestoneId,
          startTime: s.startTime
        }));
      }
      return { derive, stop, stopAll, running };
    }
    if (require.main === module2) {
      const runner = createActionDerivationRunner(/* @__PURE__ */ new Set(), ".");
      console.log("derive:", typeof runner.derive);
      console.log("stop:", typeof runner.stop);
      console.log("stopAll:", typeof runner.stopAll);
      console.log("running:", typeof runner.running);
      console.log("OK");
    }
    module2.exports = { createActionDerivationRunner };
  }
});

// src/server/revision-runner.js
var require_revision_runner = __commonJS({
  "src/server/revision-runner.js"(exports2, module2) {
    "use strict";
    var { runAI } = require_ai_runner();
    var fs = require("node:fs");
    var path = require("node:path");
    function buildRevisionPrompt(artifactContent, annotations) {
      const annotationList = annotations.map((a) => `- Line ${a.line}: ${a.text}`).join("\n");
      return "## Current plan content\n\n" + artifactContent + "\n\n## Reviewer annotations to address\n\n" + annotationList + "\n\n## Instructions\n\nRevise the plan above to address ALL the reviewer's annotations. Output ONLY the revised plan content \u2014 no explanations, no markdown fencing, no preamble. The output will directly replace the current file.";
    }
    var SYSTEM_PROMPT = "You are revising a plan artifact based on reviewer annotations. Do NOT implement anything \u2014 only update the plan document. Output ONLY the revised content with no markdown fencing or preamble.";
    function createRevisionRunner(sseClients, cwd, onComplete, registry) {
      let current = null;
      function broadcast(event, data) {
        const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
        for (const client of sseClients) {
          try {
            client.write(payload);
          } catch (_) {
            sseClients.delete(client);
          }
        }
      }
      function stripMarkdownFencing(text) {
        const trimmed = text.trim();
        const fenceMatch = trimmed.match(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/);
        if (fenceMatch) {
          return fenceMatch[1];
        }
        return trimmed;
      }
      function revise(nodeId, artifactPath, artifactContent, annotations) {
        if (current) {
          return { error: "busy", status: 409 };
        }
        const sessionId = `revision-${Date.now()}`;
        const prompt = buildRevisionPrompt(artifactContent, annotations);
        try {
          const annPath = path.join(cwd, ".planning", "annotations", nodeId.toUpperCase() + ".json");
          let round = 0;
          if (fs.existsSync(annPath)) {
            try {
              const annData = JSON.parse(fs.readFileSync(annPath, "utf-8"));
              round = annData.revisionRound || 0;
            } catch (_) {
            }
          }
          const versionedPath = artifactPath.replace(".md", "") + ".v" + round + ".md";
          fs.copyFileSync(artifactPath, versionedPath);
        } catch (_) {
        }
        const abortController = new AbortController();
        let agentId;
        if (registry) {
          const agent = registry.spawn("revision", nodeId, "");
          agentId = agent.id;
        }
        current = { sessionId, abortController, nodeId, agentId };
        runAI(prompt, {
          cwd,
          model: "sonnet",
          systemPrompt: SYSTEM_PROMPT,
          abortController,
          onText: (chunk) => {
            broadcast("revision-output", {
              sessionId,
              nodeId,
              text: chunk,
              stream: "stdout"
            });
          }
        }).then(({ text, error }) => {
          const completedNodeId = current ? current.nodeId : nodeId;
          const closingAgentId = current ? current.agentId : void 0;
          current = null;
          if (error) {
            broadcast("revision-complete", {
              sessionId,
              nodeId: completedNodeId,
              exitCode: 1,
              error: true
            });
            if (registry && closingAgentId) {
              registry.fail(closingAgentId, 1, error);
            }
            return;
          }
          try {
            const revisedContent = stripMarkdownFencing(text);
            fs.writeFileSync(artifactPath, revisedContent, "utf-8");
            const annPath = path.join(cwd, ".planning", "annotations", completedNodeId.toUpperCase() + ".json");
            let annData = { nodeId: completedNodeId.toUpperCase(), annotations: [], revisionRound: 0 };
            if (fs.existsSync(annPath)) {
              try {
                annData = JSON.parse(fs.readFileSync(annPath, "utf-8"));
              } catch (_) {
              }
            }
            const newRound = (annData.revisionRound || 0) + 1;
            annData.revisionRound = newRound;
            const annDir = path.dirname(annPath);
            fs.mkdirSync(annDir, { recursive: true });
            fs.writeFileSync(annPath, JSON.stringify(annData, null, 2), "utf-8");
            broadcast("revision-complete", {
              sessionId,
              nodeId: completedNodeId,
              exitCode: 0,
              revisionRound: newRound
            });
            if (onComplete) {
              try {
                onComplete(completedNodeId);
              } catch (_) {
              }
            }
            if (registry && closingAgentId) {
              registry.complete(closingAgentId, {
                nodeId: completedNodeId,
                planPath: artifactPath,
                revisionRound: newRound
              });
            }
          } catch (err) {
            broadcast("revision-complete", {
              sessionId,
              nodeId: completedNodeId,
              exitCode: -1,
              error: true
            });
            if (registry && closingAgentId) {
              registry.fail(closingAgentId, -1, "revision post-processing error");
            }
          }
        }).catch((err) => {
          const errorAgentId = current ? current.agentId : void 0;
          current = null;
          broadcast("revision-complete", {
            sessionId,
            nodeId,
            exitCode: -1,
            error: true
          });
          if (registry && errorAgentId) {
            registry.fail(errorAgentId, -1, "error");
          }
        });
        return { ok: true, sessionId };
      }
      function stop() {
        if (!current) {
          return { error: "not_running", status: 404 };
        }
        current.abortController.abort();
        return { ok: true };
      }
      function running() {
        return current ? current.sessionId : null;
      }
      return { revise, stop, running };
    }
    if (require.main === module2) {
      const runner = createRevisionRunner(/* @__PURE__ */ new Set(), ".", () => {
      });
      console.log("revise:", typeof runner.revise);
      console.log("stop:", typeof runner.stop);
      console.log("running:", typeof runner.running);
      console.log("OK");
    }
    module2.exports = { createRevisionRunner };
  }
});

// src/commands/workflow-state.js
var require_workflow_state = __commonJS({
  "src/commands/workflow-state.js"(exports2, module2) {
    "use strict";
    var DONE_STATUSES = /* @__PURE__ */ new Set(["DONE", "KEPT", "HONORED"]);
    var EXECUTING_STATUSES = /* @__PURE__ */ new Set(["EXECUTING", "IN_PROGRESS", "RUNNING"]);
    function computeWorkflowState(graph, runningActionIds) {
      const declarations = graph.declarations || [];
      const milestones = graph.milestones || [];
      const actions = graph.actions || [];
      const running = runningActionIds || /* @__PURE__ */ new Set();
      const actionsDone = actions.filter((a) => DONE_STATUSES.has((a.status || "").toUpperCase())).length;
      const actionsExecuting = actions.filter(
        (a) => EXECUTING_STATUSES.has((a.status || "").toUpperCase()) || running.has(a.id)
      ).length;
      const totalActions = actions.length;
      const percentage = totalActions > 0 ? Math.round(actionsDone / totalActions * 100) : 0;
      const progress = {
        declarations: declarations.length,
        milestones: milestones.length,
        actions: totalActions,
        actionsDone,
        actionsExecuting,
        percentage
      };
      if (declarations.length === 0) {
        return {
          state: "empty",
          nextStep: {
            label: "Create your first declaration",
            action: "create-declaration"
          },
          progress
        };
      }
      if (milestones.length === 0) {
        return {
          state: "declarations_only",
          nextStep: {
            label: "Derive milestones from declarations",
            action: "derive-milestones"
          },
          progress
        };
      }
      const milestonesWithActions = /* @__PURE__ */ new Set();
      for (const a of actions) {
        if (Array.isArray(a.causes)) {
          for (const mId of a.causes) {
            milestonesWithActions.add(mId.toUpperCase());
          }
        }
      }
      const pendingMilestones = milestones.filter((m) => {
        const mStatus = (m.status || "").toUpperCase();
        if (DONE_STATUSES.has(mStatus)) return false;
        return !milestonesWithActions.has(m.id.toUpperCase());
      });
      if (pendingMilestones.length > 0) {
        const target = pendingMilestones[0];
        return {
          state: "milestones_pending",
          nextStep: {
            label: `Derive actions for ${target.id}`,
            action: "derive-actions",
            targetId: target.id
          },
          progress
        };
      }
      if (actionsExecuting > 0) {
        const executingAction = actions.find(
          (a) => EXECUTING_STATUSES.has((a.status || "").toUpperCase()) || running.has(a.id)
        );
        return {
          state: "executing",
          nextStep: {
            label: executingAction ? `Executing ${executingAction.id}` : "Execution in progress",
            action: "view-execution",
            targetId: executingAction ? executingAction.id : void 0
          },
          progress
        };
      }
      if (totalActions > 0 && actionsDone === totalActions) {
        return {
          state: "complete",
          nextStep: {
            label: "All actions complete",
            action: "view-summary"
          },
          progress
        };
      }
      const pendingActions = actions.filter((a) => {
        const s = (a.status || "").toUpperCase();
        return !DONE_STATUSES.has(s) && !EXECUTING_STATUSES.has(s);
      });
      const nextAction = pendingActions[0];
      return {
        state: "actions_pending",
        nextStep: {
          label: nextAction ? `Execute ${nextAction.id}` : "Plan next actions",
          action: nextAction ? "execute-action" : "plan-actions",
          targetId: nextAction ? nextAction.id : void 0
        },
        progress
      };
    }
    module2.exports = { computeWorkflowState };
  }
});

// src/commands/play.js
var require_play = __commonJS({
  "src/commands/play.js"(exports2, module2) {
    "use strict";
    var { spawn } = require("node:child_process");
    var fs = require("node:fs");
    var path = require("node:path");
    var { runLoadGraph: runLoadGraph2 } = require_load_graph();
    var { runGetExecPlan: runGetExecPlan2 } = require_get_exec_plan();
    var { findMilestoneFolder } = require_milestone_folders();
    var DONE_STATUSES = /* @__PURE__ */ new Set(["DONE", "KEPT", "HONORED", "RENEGOTIATED"]);
    function computePlayOrder(graph) {
      const milestones = graph.milestones || [];
      const actions = graph.actions || [];
      const candidates = milestones.filter(
        (m) => (m.classification || "agent") === "agent" && !DONE_STATUSES.has((m.status || "").toUpperCase())
      );
      if (candidates.length === 0) {
        return { waves: [] };
      }
      const candidateIds = new Set(candidates.map((m) => m.id.toUpperCase()));
      const deps = /* @__PURE__ */ new Map();
      for (const m of candidates) {
        const mId = m.id.toUpperCase();
        const mDeps = (m.dependsOn || []).map((d) => d.toUpperCase()).filter((d) => candidateIds.has(d));
        deps.set(mId, mDeps);
      }
      const waves = [];
      const placed = /* @__PURE__ */ new Set();
      while (placed.size < candidates.length) {
        const wave = [];
        for (const m of candidates) {
          const mId = m.id.toUpperCase();
          if (placed.has(mId)) continue;
          const mDeps = deps.get(mId) || [];
          const allDepsMet = mDeps.every(
            (d) => placed.has(d) || !candidateIds.has(d)
          );
          if (!allDepsMet) continue;
          const milestoneActions = actions.filter(
            (a) => (a.causes || []).some((c) => c.toUpperCase() === mId) && !DONE_STATUSES.has((a.status || "").toUpperCase())
          ).map((a) => a.id);
          if (milestoneActions.length > 0) {
            wave.push({ milestoneId: m.id, actions: milestoneActions });
          }
        }
        if (wave.length === 0) {
          let progress = false;
          for (const m of candidates) {
            const mId = m.id.toUpperCase();
            if (placed.has(mId)) continue;
            const mDeps = deps.get(mId) || [];
            const allDepsMet = mDeps.every(
              (d) => placed.has(d) || !candidateIds.has(d)
            );
            if (allDepsMet) {
              placed.add(mId);
              progress = true;
            }
          }
          if (!progress) break;
          continue;
        }
        waves.push(wave);
        for (const entry of wave) {
          placed.add(entry.milestoneId.toUpperCase());
        }
        for (const m of candidates) {
          const mId = m.id.toUpperCase();
          if (placed.has(mId)) continue;
          const mDeps = deps.get(mId) || [];
          if (mDeps.every((d) => placed.has(d) || !candidateIds.has(d))) {
            placed.add(mId);
          }
        }
      }
      return { waves };
    }
    function appendLog(logPath, line) {
      if (!logPath) return;
      try {
        fs.appendFileSync(logPath, line + "\n", "utf-8");
      } catch (_) {
      }
    }
    function createPlayRunner(sseClients, cwd) {
      let isRunning = false;
      let stopRequested = false;
      const activeProcesses = /* @__PURE__ */ new Map();
      let playState = null;
      function broadcast(event, data) {
        const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
        for (const client of sseClients) {
          try {
            client.write(payload);
          } catch (_) {
            sseClients.delete(client);
          }
        }
      }
      function executeAction(actionId, milestoneId) {
        return new Promise((resolve) => {
          const prompt = `Run /declare:execute ${milestoneId} for action ${actionId} only. Do not ask questions, execute autonomously.`;
          const proc = spawn("claude", ["-p", prompt, "--no-input"], {
            cwd,
            env: { ...process.env, FORCE_COLOR: "0" }
          });
          activeProcesses.set(actionId, proc);
          const planningDir = path.join(cwd, ".planning");
          const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
          const logPath = milestoneFolder ? path.join(milestoneFolder, "execution.log") : void 0;
          appendLog(logPath, `
=== START ${actionId} (play) @ ${(/* @__PURE__ */ new Date()).toISOString()} ===`);
          let stdoutBuf = "";
          let stderrBuf = "";
          if (proc.stdout) {
            proc.stdout.on("data", (chunk) => {
              stdoutBuf += chunk.toString();
              const lines = stdoutBuf.split("\n");
              stdoutBuf = lines.pop() || "";
              for (const line of lines) {
                broadcast("action-output", { actionId, text: line, stream: "stdout" });
                appendLog(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] [${actionId}] [stdout] ${line}`);
              }
            });
          }
          if (proc.stderr) {
            proc.stderr.on("data", (chunk) => {
              stderrBuf += chunk.toString();
              const lines = stderrBuf.split("\n");
              stderrBuf = lines.pop() || "";
              for (const line of lines) {
                broadcast("action-output", { actionId, text: line, stream: "stderr" });
                appendLog(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] [${actionId}] [stderr] ${line}`);
              }
            });
          }
          proc.on("close", (exitCode) => {
            const code = exitCode ?? -1;
            appendLog(logPath, `=== END ${actionId} (play) @ ${(/* @__PURE__ */ new Date()).toISOString()} exit=${code} ===
`);
            activeProcesses.delete(actionId);
            broadcast("action-complete", { actionId, exitCode: code });
            resolve({ actionId, exitCode: code });
          });
          proc.on("error", (_err) => {
            appendLog(logPath, `=== ERROR ${actionId} (play) @ ${(/* @__PURE__ */ new Date()).toISOString()} ===
`);
            activeProcesses.delete(actionId);
            broadcast("action-complete", { actionId, exitCode: -1 });
            resolve({ actionId, exitCode: -1 });
          });
        });
      }
      function start() {
        if (isRunning) {
          return { error: "Play is already running" };
        }
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          return { error: graph.error };
        }
        let waves;
        const manifest = loadManifest(cwd);
        if (manifest) {
          const actionStatusMap = /* @__PURE__ */ new Map();
          for (const a of graph.actions || []) {
            actionStatusMap.set(a.id.toUpperCase(), (a.status || "").toUpperCase());
          }
          waves = manifest.waves.map((w) => {
            const milestones = w.milestones.map((m) => {
              const pendingActions = m.actions.filter((actionId) => {
                const status2 = actionStatusMap.get(actionId.toUpperCase()) || "";
                return !DONE_STATUSES.has(status2);
              });
              return pendingActions.length > 0 ? { milestoneId: m.id, actions: pendingActions } : null;
            }).filter(Boolean);
            return milestones.length > 0 ? milestones : null;
          }).filter(Boolean);
        } else {
          waves = computePlayOrder(graph).waves;
        }
        if (waves.length === 0) {
          return { error: "No ready agent milestones with pending actions" };
        }
        const allActions = [];
        for (const wave of waves) {
          for (const entry of wave) {
            for (const actionId of entry.actions) {
              const action = (graph.actions || []).find((a) => a.id.toUpperCase() === actionId.toUpperCase());
              if (action) allActions.push(action);
            }
          }
        }
        const unapprovedActions = allActions.filter((a) => a.reviewState !== "approved");
        if (unapprovedActions.length > 0) {
          return {
            error: "Cannot play: unapproved actions exist",
            unapproved: unapprovedActions.map((a) => ({ id: a.id, title: a.title, reviewState: a.reviewState || "draft" }))
          };
        }
        isRunning = true;
        stopRequested = false;
        playState = {
          currentWave: 0,
          totalWaves: waves.length,
          waveItems: [],
          completedActions: [],
          failedActions: []
        };
        broadcast("play-start", {
          totalWaves: waves.length,
          waves: waves.map((w, i) => ({
            wave: i + 1,
            milestones: w.map((e) => ({ milestoneId: e.milestoneId, actions: e.actions }))
          }))
        });
        (async () => {
          for (let wi = 0; wi < waves.length; wi++) {
            if (stopRequested) break;
            const wave = waves[wi];
            playState.currentWave = wi + 1;
            playState.waveItems = wave;
            broadcast("play-wave-start", {
              wave: wi + 1,
              totalWaves: waves.length,
              milestones: wave.map((e) => ({ milestoneId: e.milestoneId, actions: e.actions }))
            });
            const promises = [];
            for (const entry of wave) {
              for (const actionId of entry.actions) {
                if (stopRequested) break;
                promises.push(executeAction(actionId, entry.milestoneId));
              }
              if (stopRequested) break;
            }
            const results = await Promise.all(promises);
            for (const r of results) {
              if (r.exitCode === 0) {
                playState.completedActions.push(r.actionId);
              } else {
                playState.failedActions.push(r.actionId);
              }
            }
            broadcast("play-wave-complete", {
              wave: wi + 1,
              totalWaves: waves.length,
              completed: results.filter((r) => r.exitCode === 0).map((r) => r.actionId),
              failed: results.filter((r) => r.exitCode !== 0).map((r) => r.actionId)
            });
          }
          const finalState = { ...playState };
          isRunning = false;
          playState = null;
          broadcast("play-complete", {
            completed: finalState.completedActions,
            failed: finalState.failedActions,
            stopped: stopRequested
          });
          stopRequested = false;
        })().catch((_err) => {
          isRunning = false;
          playState = null;
          broadcast("play-complete", { completed: [], failed: [], stopped: false, error: String(_err) });
        });
        return { ok: true, waves: waves.length };
      }
      function stop() {
        if (!isRunning) {
          return { error: "Play is not running" };
        }
        stopRequested = true;
        for (const [, proc] of activeProcesses) {
          try {
            proc.kill("SIGTERM");
          } catch (_) {
          }
        }
        return { ok: true };
      }
      function running() {
        return isRunning;
      }
      function status() {
        if (!playState) return null;
        return {
          running: isRunning,
          currentWave: playState.currentWave,
          totalWaves: playState.totalWaves,
          activeActions: [...activeProcesses.keys()],
          completedActions: playState.completedActions,
          failedActions: playState.failedActions
        };
      }
      return { start, stop, running, status };
    }
    function loadManifest(cwd) {
      const manifestPath = path.join(cwd, ".planning", "execution-manifest.json");
      try {
        const raw = fs.readFileSync(manifestPath, "utf8");
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.waves) && data.waves.length > 0) {
          return data;
        }
        return null;
      } catch (_) {
        return null;
      }
    }
    module2.exports = { computePlayOrder, createPlayRunner, loadManifest };
  }
});

// src/commands/lifecycle-stages.js
var require_lifecycle_stages = __commonJS({
  "src/commands/lifecycle-stages.js"(exports2, module2) {
    "use strict";
    var COMPLETED_STATUSES = /* @__PURE__ */ new Set(["DONE", "KEPT", "HONORED"]);
    var EXECUTING_STATUSES = /* @__PURE__ */ new Set(["EXECUTING", "IN_PROGRESS", "RUNNING"]);
    function computeLifecycleStages(graph, runningActionIds) {
      const { declarations = [], milestones = [], actions = [] } = graph;
      const running = runningActionIds || /* @__PURE__ */ new Set();
      const stages = {
        "needs-planning": [],
        "needs-approval": [],
        "ready-to-execute": [],
        "in-execution": [],
        "done": []
      };
      const milestoneById = new Map(milestones.map((m) => [m.id, m]));
      const actionsByMilestone = /* @__PURE__ */ new Map();
      for (const a of actions) {
        for (const mId of a.causes || []) {
          if (!actionsByMilestone.has(mId)) actionsByMilestone.set(mId, []);
          actionsByMilestone.get(mId).push(a);
        }
      }
      const milestonesByDecl = /* @__PURE__ */ new Map();
      for (const d of declarations) {
        milestonesByDecl.set(d.id, (d.milestones || []).filter((mId) => milestoneById.has(mId)));
      }
      for (const d of declarations) {
        const status = (d.status || "").toUpperCase();
        if (COMPLETED_STATUSES.has(status)) {
          stages["done"].push(makeItem(d, "declaration", "done"));
          continue;
        }
        const myMilestones = milestonesByDecl.get(d.id) || [];
        if (myMilestones.length === 0) {
          stages["needs-planning"].push(makeItem(d, "declaration", "needs-planning"));
          continue;
        }
        if (d.reviewState !== "approved") {
          stages["needs-approval"].push(makeItem(d, "declaration", "needs-approval"));
          continue;
        }
        const allMilestonesDone = myMilestones.every((mId) => {
          const m = milestoneById.get(mId);
          return m && COMPLETED_STATUSES.has((m.status || "").toUpperCase());
        });
        if (allMilestonesDone) {
          stages["done"].push(makeItem(d, "declaration", "done"));
        } else {
        }
      }
      for (const m of milestones) {
        const status = (m.status || "").toUpperCase();
        if (COMPLETED_STATUSES.has(status)) {
          stages["done"].push(makeItem(m, "milestone", "done"));
          continue;
        }
        const myActions = actionsByMilestone.get(m.id) || [];
        const hasPlan = m.hasPlan || myActions.length > 0;
        if (!hasPlan) {
          stages["needs-planning"].push(makeItem(m, "milestone", "needs-planning"));
          continue;
        }
        if (m.reviewState !== "approved") {
          stages["needs-approval"].push(makeItem(m, "milestone", "needs-approval"));
          continue;
        }
        const hasExecuting = myActions.some(
          (a) => EXECUTING_STATUSES.has((a.status || "").toUpperCase()) || running.has(a.id)
        );
        if (hasExecuting) {
          stages["in-execution"].push(makeItem(m, "milestone", "in-execution"));
          continue;
        }
        const allActionsDone = myActions.length > 0 && myActions.every(
          (a) => COMPLETED_STATUSES.has((a.status || "").toUpperCase())
        );
        if (allActionsDone) {
          stages["done"].push(makeItem(m, "milestone", "done"));
          continue;
        }
        const deps = m.dependsOn || [];
        const depsBlocked = deps.some((depId) => {
          const dep = milestoneById.get(depId);
          return !dep || !COMPLETED_STATUSES.has((dep.status || "").toUpperCase());
        });
        if (depsBlocked) {
          stages["needs-approval"].push(makeItem(m, "milestone", "needs-approval"));
        } else {
          stages["ready-to-execute"].push(makeItem(m, "milestone", "ready-to-execute"));
        }
      }
      for (const a of actions) {
        const status = (a.status || "").toUpperCase();
        if (COMPLETED_STATUSES.has(status)) {
          stages["done"].push(makeItem(a, "action", "done"));
          continue;
        }
        if (EXECUTING_STATUSES.has(status) || running.has(a.id)) {
          stages["in-execution"].push(makeItem(a, "action", "in-execution"));
          continue;
        }
        if (a.reviewState !== "approved") {
          stages["needs-approval"].push(makeItem(a, "action", "needs-approval"));
          continue;
        }
        const parentMilestones = (a.causes || []).map((mId) => milestoneById.get(mId)).filter(Boolean);
        const parentBlocked = parentMilestones.some((m) => {
          const deps = m.dependsOn || [];
          return deps.some((depId) => {
            const dep = milestoneById.get(depId);
            return !dep || !COMPLETED_STATUSES.has((dep.status || "").toUpperCase());
          });
        });
        if (parentBlocked) {
          stages["needs-approval"].push(makeItem(a, "action", "needs-approval"));
        } else {
          stages["ready-to-execute"].push(makeItem(a, "action", "ready-to-execute"));
        }
      }
      const nextAction = computeNextAction(stages, declarations, milestones, actions);
      const total = declarations.length + milestones.length + actions.length;
      const done = stages["done"].length;
      const percentage = total > 0 ? Math.round(done / total * 100) : 0;
      return {
        stages,
        nextAction,
        progress: { total, done, percentage }
      };
    }
    function computeNextAction(stages, declarations, milestones, actions) {
      const planningDecl = stages["needs-planning"].find((item) => item.type === "declaration");
      if (planningDecl) {
        return {
          action: "derive-milestones",
          label: `Plan milestones for ${planningDecl.id}`,
          targetId: planningDecl.id,
          targetType: "declaration"
        };
      }
      const planningMile = stages["needs-planning"].find((item) => item.type === "milestone");
      if (planningMile) {
        return {
          action: "derive-actions",
          label: `Plan actions for ${planningMile.id}`,
          targetId: planningMile.id,
          targetType: "milestone"
        };
      }
      if (stages["needs-approval"].length > 0) {
        const first = stages["needs-approval"][0];
        return {
          action: "approve",
          label: `Review ${first.id}`,
          targetId: first.id,
          targetType: first.type
        };
      }
      if (stages["ready-to-execute"].length > 0) {
        return {
          action: "execute",
          label: "Execute approved actions"
        };
      }
      if (stages["in-execution"].length > 0) {
        return {
          action: "view-execution",
          label: "Execution in progress"
        };
      }
      const total = declarations.length + milestones.length + actions.length;
      if (total > 0) {
        return {
          action: "complete",
          label: "All items complete"
        };
      }
      return null;
    }
    function makeItem(node, type, stage) {
      return {
        id: node.id,
        title: node.title || node.statement || node.id,
        type,
        status: node.status || "PENDING",
        reviewState: node.reviewState,
        stage
      };
    }
    module2.exports = { computeLifecycleStages, COMPLETED_STATUSES, EXECUTING_STATUSES };
  }
});

// src/server/pipeline-runner.js
var require_pipeline_runner = __commonJS({
  "src/server/pipeline-runner.js"(exports2, module2) {
    "use strict";
    var { runAI } = require_ai_runner();
    var { execSync } = require("node:child_process");
    var fs = require("node:fs");
    var path = require("node:path");
    var { findMilestoneFolder } = require_milestone_folders();
    var STATE_FILE = ".planning/pipeline-state.json";
    var OUTPUT_BUFFER_MAX = 5e4;
    function appendLog(logPath, line) {
      if (!logPath) return;
      try {
        fs.appendFileSync(logPath, line + "\n", "utf-8");
      } catch (_) {
      }
    }
    function isTransientFailure(exitCode, errorOutput) {
      if (exitCode === 124 || exitCode === 137 || exitCode === -1) return true;
      const patterns = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOMEM|SIGKILL|SIGTERM|socket hang up|network timeout|Cancelled/i;
      return patterns.test(errorOutput);
    }
    function generateExecutionReport(cwd, results, pipelineStartTime, pipelineStopped, startSha) {
      try {
        let endSha = "unknown";
        try {
          endSha = execSync("git rev-parse --short HEAD", { cwd }).toString().trim();
        } catch (_) {
        }
        const endTime = Date.now();
        const totalMs = endTime - pipelineStartTime;
        const totalMin = Math.floor(totalMs / 6e4);
        const totalSec = Math.floor(totalMs % 6e4 / 1e3);
        const passed = results.filter((r) => r.exitCode === 0).length;
        const failed = results.filter((r) => r.exitCode !== 0).length;
        const overallStatus = pipelineStopped ? "STOPPED" : failed > 0 ? "FAILED" : "SUCCESS";
        const startedAt = new Date(pipelineStartTime).toISOString();
        const completedAt = new Date(endTime).toISOString();
        let rows = "";
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const status = r.exitCode === 0 ? "PASS" : "FAIL";
          const durMin = Math.floor(r.durationMs / 6e4);
          const durSec = Math.floor(r.durationMs % 6e4 / 1e3);
          const retried = r.retried ? `Yes (${r.attempts})` : "No";
          rows += `| ${i + 1} | ${r.actionId} | ${r.milestoneId} | ${status} | ${durMin}m ${durSec}s | ${retried} |
`;
        }
        const report = `# Execution Report

**Status:** ${overallStatus}
**Started:** ${startedAt}
**Completed:** ${completedAt}
**Duration:** ${totalMin}m ${totalSec}s
**Commits:** ${startSha}..${endSha}

## Results

| # | Action | Milestone | Status | Duration | Retried |
|---|--------|-----------|--------|----------|---------|
${rows}
## Summary

- **Passed:** ${passed}
- **Failed:** ${failed}
- **Total:** ${results.length}
`;
        const reportPath = path.join(cwd, ".planning", "execution-report.md");
        fs.writeFileSync(reportPath, report, "utf8");
        return reportPath;
      } catch (_) {
        return null;
      }
    }
    function createPipelineRunner(sseClients, cwd, registry) {
      let isRunning = false;
      let stopRequested = false;
      const activeControllers = /* @__PURE__ */ new Map();
      let results = [];
      let pipelineState = null;
      let pausedOnFailure = null;
      let skipResolve = null;
      const outputBuffers = {};
      let totalActionCount = 0;
      let pipelineAgentId;
      const actionAgentIds = /* @__PURE__ */ new Map();
      function persistState() {
        if (!pipelineState) {
          try {
            fs.unlinkSync(path.join(cwd, STATE_FILE));
          } catch (_) {
          }
          return;
        }
        const state = {
          running: isRunning,
          currentWave: pipelineState.currentWave,
          totalWaves: pipelineState.totalWaves,
          totalActions: totalActionCount,
          completedActions: pipelineState.completedActions,
          failedActions: pipelineState.failedActions,
          stoppedActions: pipelineState.stoppedActions,
          activeActions: [...activeControllers.keys()],
          outputBuffers,
          pausedOnFailure,
          timestamp: Date.now()
        };
        try {
          fs.writeFileSync(path.join(cwd, STATE_FILE), JSON.stringify(state, null, 2));
        } catch (_) {
        }
      }
      function broadcast(event, data) {
        const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
        for (const client of sseClients) {
          try {
            client.write(payload);
          } catch (_) {
            sseClients.delete(client);
          }
        }
      }
      function loadManifest() {
        const manifestPath = path.join(cwd, ".planning", "execution-manifest.json");
        if (!fs.existsSync(manifestPath)) {
          return { error: "Execution manifest not found at .planning/execution-manifest.json" };
        }
        try {
          const raw = fs.readFileSync(manifestPath, "utf8");
          const data = JSON.parse(raw);
          if (!data || !Array.isArray(data.waves) || data.waves.length === 0) {
            return { error: "Execution manifest is malformed: waves must be a non-empty array" };
          }
          for (let i = 0; i < data.waves.length; i++) {
            const wave = data.waves[i];
            if (!Array.isArray(wave.milestones)) {
              return { error: `Execution manifest malformed: waves[${i}].milestones must be an array` };
            }
            for (let j = 0; j < wave.milestones.length; j++) {
              const m = wave.milestones[j];
              if (typeof m.id !== "string" || !m.id) {
                return { error: `Execution manifest malformed: waves[${i}].milestones[${j}].id must be a non-empty string` };
              }
              if (!Array.isArray(m.actions)) {
                return { error: `Execution manifest malformed: waves[${i}].milestones[${j}].actions must be an array` };
              }
            }
          }
          return { waves: data.waves };
        } catch (err) {
          return { error: `Failed to parse execution manifest: ${String(err)}` };
        }
      }
      function executeAction(actionId, milestoneId) {
        const startedAt = (/* @__PURE__ */ new Date()).toISOString();
        const startTime = Date.now();
        if (registry) {
          const agent = registry.spawn("execution", actionId, milestoneId);
          actionAgentIds.set(actionId, agent.id);
        }
        const prompt = `Run /declare:execute ${milestoneId} for action ${actionId} only. Do not ask questions, execute autonomously.`;
        const abortController = new AbortController();
        activeControllers.set(actionId, abortController);
        const planningDir = path.join(cwd, ".planning");
        const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
        const logPath = milestoneFolder ? path.join(milestoneFolder, "execution.log") : void 0;
        appendLog(logPath, `
=== START ${actionId} (pipeline) @ ${startedAt} ===`);
        return runAI(prompt, {
          cwd,
          model: "sonnet",
          withTools: true,
          maxTurns: 10,
          abortController,
          onText: (chunk) => {
            broadcast("action-output", { actionId, text: chunk, stream: "stdout" });
            appendLog(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] [${actionId}] [stdout] ${chunk}`);
            if (!outputBuffers[actionId]) outputBuffers[actionId] = "";
            outputBuffers[actionId] += chunk;
            if (outputBuffers[actionId].length > OUTPUT_BUFFER_MAX) {
              outputBuffers[actionId] = outputBuffers[actionId].slice(-OUTPUT_BUFFER_MAX);
            }
          }
        }).then(({ text, error }) => {
          const exitCode = error ? 1 : 0;
          const completedAt = (/* @__PURE__ */ new Date()).toISOString();
          const durationMs = Date.now() - startTime;
          appendLog(logPath, `=== END ${actionId} (pipeline) @ ${completedAt} exit=${exitCode} duration=${durationMs}ms ===
`);
          activeControllers.delete(actionId);
          broadcast("action-complete", { actionId, exitCode, durationMs });
          if (registry) {
            const aId = actionAgentIds.get(actionId);
            if (aId) {
              if (exitCode === 0) {
                registry.complete(aId, {
                  actionId,
                  milestoneId,
                  logPath: logPath || null,
                  durationMs
                });
              } else {
                registry.fail(aId, exitCode, error || "execution failed");
              }
              actionAgentIds.delete(actionId);
            }
          }
          return { actionId, milestoneId, exitCode, errorOutput: error || "", durationMs, startedAt, completedAt, retried: false, attempts: 1 };
        }).catch((err) => {
          const completedAt = (/* @__PURE__ */ new Date()).toISOString();
          const durationMs = Date.now() - startTime;
          appendLog(logPath, `=== ERROR ${actionId} (pipeline) @ ${completedAt} ===
`);
          activeControllers.delete(actionId);
          broadcast("action-complete", { actionId, exitCode: -1, durationMs });
          if (registry) {
            const aId = actionAgentIds.get(actionId);
            if (aId) {
              registry.fail(aId, -1, String(err.message || err));
              actionAgentIds.delete(actionId);
            }
          }
          return { actionId, milestoneId, exitCode: -1, errorOutput: String(err.message || err), durationMs, startedAt, completedAt, retried: false, attempts: 1 };
        });
      }
      function start() {
        if (isRunning) {
          return { error: "Pipeline is already running" };
        }
        const manifest = loadManifest();
        if ("error" in manifest) {
          return { error: manifest.error };
        }
        const waves = manifest.waves;
        isRunning = true;
        stopRequested = false;
        results = [];
        if (registry) {
          const agent = registry.spawn("pipeline", "manifest", "");
          pipelineAgentId = agent.id;
        }
        pipelineState = {
          currentWave: 0,
          totalWaves: waves.length,
          completedActions: [],
          failedActions: [],
          stoppedActions: [],
          skippedActions: []
        };
        let totalActions = 0;
        for (const wave of waves) {
          for (const m of wave.milestones) {
            totalActions += m.actions.length;
          }
        }
        totalActionCount = totalActions;
        persistState();
        broadcast("pipeline-start", {
          totalWaves: waves.length,
          totalActions,
          waves: waves.map((w, i) => ({
            wave: i + 1,
            milestones: w.milestones.map((m) => ({ id: m.id, actions: m.actions }))
          }))
        });
        (async () => {
          const pipelineStartTime = Date.now();
          let startSha = "unknown";
          try {
            startSha = execSync("git rev-parse --short HEAD", { cwd }).toString().trim();
          } catch (_) {
          }
          for (let wi = 0; wi < waves.length; wi++) {
            if (stopRequested) break;
            const wave = waves[wi];
            pipelineState.currentWave = wi + 1;
            persistState();
            broadcast("pipeline-wave-start", {
              wave: wi + 1,
              totalWaves: waves.length,
              milestones: wave.milestones.map((m) => ({ id: m.id, actions: m.actions }))
            });
            const promises = [];
            for (const milestone of wave.milestones) {
              for (const actionId of milestone.actions) {
                if (stopRequested) break;
                promises.push(executeAction(actionId, milestone.id));
              }
              if (stopRequested) break;
            }
            const waveResults = await Promise.all(promises);
            for (let ri = 0; ri < waveResults.length; ri++) {
              const r = waveResults[ri];
              if (r.exitCode !== 0 && !stopRequested && isTransientFailure(r.exitCode, r.errorOutput)) {
                broadcast("action-retry", { actionId: r.actionId, milestoneId: r.milestoneId, attempt: 2, reason: "transient failure detected" });
                appendLog(
                  findMilestoneFolder(path.join(cwd, ".planning"), r.milestoneId) ? path.join(findMilestoneFolder(path.join(cwd, ".planning"), r.milestoneId), "execution.log") : void 0,
                  `
=== RETRY ${r.actionId} (attempt 2) ===`
                );
                const retryResult = await executeAction(r.actionId, r.milestoneId);
                retryResult.retried = true;
                retryResult.attempts = 2;
                waveResults[ri] = retryResult;
              }
            }
            results.push(...waveResults);
            for (const r of waveResults) {
              if (r.exitCode === 0) {
                pipelineState.completedActions.push(r.actionId);
              } else {
                pipelineState.failedActions.push(r.actionId);
              }
            }
            persistState();
            broadcast("pipeline-wave-complete", {
              wave: wi + 1,
              totalWaves: waves.length,
              completed: waveResults.filter((r) => r.exitCode === 0).map((r) => r.actionId),
              failed: waveResults.filter((r) => r.exitCode !== 0).map((r) => r.actionId)
            });
            const failedInWave = waveResults.filter((r) => r.exitCode !== 0);
            if (failedInWave.length > 0 && !stopRequested) {
              const firstFailed = failedInWave[0];
              pausedOnFailure = { actionId: firstFailed.actionId, exitCode: firstFailed.exitCode, waveIndex: wi };
              persistState();
              broadcast("pipeline-paused", {
                actionId: firstFailed.actionId,
                exitCode: firstFailed.exitCode,
                wave: wi + 1,
                totalWaves: waves.length,
                failedActions: failedInWave.map((r) => r.actionId)
              });
              const decision = await new Promise((resolve) => {
                skipResolve = resolve;
              });
              skipResolve = null;
              if (decision === "stop") {
                stopRequested = true;
                pausedOnFailure = null;
                break;
              }
              for (const f of failedInWave) {
                pipelineState.skippedActions.push(f.actionId);
              }
              pausedOnFailure = null;
              broadcast("pipeline-resumed", { wave: wi + 1, skipped: failedInWave.map((r) => r.actionId) });
            }
          }
          const finalState = { ...pipelineState };
          const finalResults = [...results];
          isRunning = false;
          if (stopRequested) {
            for (const actionId of activeControllers.keys()) {
              finalState.stoppedActions.push(actionId);
            }
          }
          const reportPath = generateExecutionReport(cwd, finalResults, pipelineStartTime, stopRequested, startSha);
          if (reportPath) {
            broadcast("pipeline-report", { path: ".planning/execution-report.md" });
          }
          broadcast("pipeline-complete", {
            completed: finalState.completedActions,
            failed: finalState.failedActions,
            stopped: stopRequested ? finalState.stoppedActions : [],
            results: finalResults,
            reportPath: reportPath ? ".planning/execution-report.md" : null
          });
          if (registry && pipelineAgentId) {
            const failed = finalState.failedActions.length;
            if (failed === 0 && !stopRequested) {
              registry.complete(pipelineAgentId, {
                completed: finalState.completedActions.length,
                failed: 0,
                reportPath: reportPath ? ".planning/execution-report.md" : null
              });
            } else {
              registry.fail(pipelineAgentId, 1, stopRequested ? "stopped by user" : `${failed} action(s) failed`);
            }
            pipelineAgentId = void 0;
          }
          stopRequested = false;
          pausedOnFailure = null;
          pipelineState = null;
          persistState();
        })().catch((_err) => {
          isRunning = false;
          pausedOnFailure = null;
          pipelineState = null;
          persistState();
          if (registry && pipelineAgentId) {
            registry.fail(pipelineAgentId, -1, String(_err));
            pipelineAgentId = void 0;
          }
          broadcast("pipeline-complete", {
            completed: [],
            failed: [],
            stopped: [],
            error: String(_err),
            results
          });
        });
        return { ok: true, waves: waves.length };
      }
      function stop() {
        if (!isRunning) {
          return { error: "Pipeline is not running" };
        }
        stopRequested = true;
        if (pausedOnFailure && skipResolve) {
          skipResolve("stop");
          skipResolve = null;
        }
        for (const [actionId, controller] of activeControllers) {
          try {
            controller.abort();
          } catch (_) {
          }
          if (registry) {
            const aId = actionAgentIds.get(actionId);
            if (aId) {
              registry.fail(aId, -1, "stopped by user");
              actionAgentIds.delete(actionId);
            }
          }
        }
        persistState();
        return { ok: true };
      }
      function running() {
        return isRunning;
      }
      function status() {
        if (!pipelineState) return null;
        return {
          running: isRunning,
          currentWave: pipelineState.currentWave,
          totalWaves: pipelineState.totalWaves,
          activeActions: [...activeControllers.keys()],
          completedActions: pipelineState.completedActions,
          failedActions: pipelineState.failedActions,
          results
        };
      }
      function skip() {
        if (!pausedOnFailure) {
          return { error: "Pipeline is not paused" };
        }
        if (skipResolve) {
          skipResolve("skip");
          skipResolve = null;
        }
        return { ok: true };
      }
      function paused() {
        return pausedOnFailure;
      }
      function getFullState() {
        if (!isRunning && !pausedOnFailure) return null;
        return {
          running: isRunning,
          currentWave: pipelineState ? pipelineState.currentWave : 0,
          totalWaves: pipelineState ? pipelineState.totalWaves : 0,
          totalActions: totalActionCount,
          completedActions: pipelineState ? pipelineState.completedActions : [],
          failedActions: pipelineState ? pipelineState.failedActions : [],
          activeActions: [...activeControllers.keys()],
          outputBuffers,
          pausedOnFailure
        };
      }
      return { start, stop, skip, running, paused, status, getFullState };
    }
    module2.exports = { createPipelineRunner };
  }
});

// src/server/agent-registry.js
var require_agent_registry = __commonJS({
  "src/server/agent-registry.js"(exports2, module2) {
    "use strict";
    var fs = require("node:fs");
    var path = require("node:path");
    var RECENT_MAX = 50;
    var RECENT_MAX_AGE_MS = 30 * 60 * 1e3;
    function createAgentRegistry(cwd, broadcastFn) {
      const agents = /* @__PURE__ */ new Map();
      let recentAgents = [];
      const statePath = path.join(cwd, ".planning", "agent-state.json");
      function pruneRecent() {
        const cutoff = Date.now() - RECENT_MAX_AGE_MS;
        recentAgents = recentAgents.filter((a) => {
          const ts = a.completedAt || a.updatedAt;
          return new Date(ts).getTime() > cutoff;
        });
      }
      function moveToRecent(agentId) {
        const record = agents.get(agentId);
        if (!record) return;
        agents.delete(agentId);
        recentAgents.push(record);
        if (recentAgents.length > RECENT_MAX) {
          recentAgents = recentAgents.slice(recentAgents.length - RECENT_MAX);
        }
      }
      function persistState() {
        try {
          const state = {
            agents: Object.fromEntries(agents),
            recentAgents,
            persistedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
        } catch (_) {
        }
      }
      function spawn(type, target, milestoneId) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const id = `${type.slice(0, 4)}-${target}-${Date.now()}`;
        const record = {
          id,
          type,
          target,
          milestoneId: milestoneId || "",
          status: "running",
          startedAt: now,
          updatedAt: now,
          completedAt: null,
          exitCode: null,
          error: null,
          result: null
        };
        agents.set(id, record);
        broadcastFn("agent-start", record);
        persistState();
        return record;
      }
      function update(agentId, patch) {
        const record = agents.get(agentId);
        if (!record) return null;
        Object.assign(record, patch, { updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
        broadcastFn("agent-update", record);
        persistState();
        return record;
      }
      function complete(agentId, result) {
        const record = agents.get(agentId);
        if (!record) return null;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        record.status = "complete";
        record.completedAt = now;
        record.updatedAt = now;
        record.exitCode = 0;
        record.result = result;
        moveToRecent(agentId);
        broadcastFn("agent-complete", record);
        persistState();
        return record;
      }
      function fail(agentId, exitCode, errorMessage) {
        const record = agents.get(agentId);
        if (!record) return null;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        record.status = "failed";
        record.completedAt = now;
        record.updatedAt = now;
        record.exitCode = exitCode;
        record.error = errorMessage;
        moveToRecent(agentId);
        broadcastFn("agent-complete", record);
        persistState();
        return record;
      }
      function get(agentId) {
        const active = agents.get(agentId);
        if (active) return active;
        return recentAgents.find((a) => a.id === agentId) || null;
      }
      function getActive() {
        return [...agents.values()];
      }
      function getRecent(limit = 20) {
        pruneRecent();
        return recentAgents.slice(-limit);
      }
      function getAll() {
        return { active: getActive(), recent: getRecent() };
      }
      function markInterrupted(agentIds) {
        for (const id of agentIds) {
          const record = agents.get(id);
          if (!record) continue;
          const now = (/* @__PURE__ */ new Date()).toISOString();
          record.status = "interrupted";
          record.completedAt = now;
          record.updatedAt = now;
          moveToRecent(id);
        }
        persistState();
      }
      function loadFromDisk() {
        try {
          const raw = fs.readFileSync(statePath, "utf-8");
          return JSON.parse(raw);
        } catch (_) {
          return null;
        }
      }
      function restoreFromDisk() {
        const persisted = loadFromDisk();
        if (!persisted) return { restored: 0, interrupted: 0 };
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let interruptedCount = 0;
        const seenIds = new Set(recentAgents.map((a) => a.id));
        const persistedAgents = persisted.agents || {};
        for (const [id, record] of Object.entries(persistedAgents)) {
          if (seenIds.has(id)) continue;
          record.status = "interrupted";
          record.completedAt = now;
          record.updatedAt = now;
          record.exitCode = -1;
          record.error = "server restarted";
          recentAgents.push(record);
          seenIds.add(id);
          interruptedCount++;
        }
        const cutoff = Date.now() - RECENT_MAX_AGE_MS;
        const persistedRecent = persisted.recentAgents || [];
        for (const record of persistedRecent) {
          if (seenIds.has(record.id)) continue;
          const ts = record.completedAt || record.updatedAt;
          if (new Date(ts).getTime() <= cutoff) continue;
          recentAgents.push(record);
          seenIds.add(record.id);
        }
        if (recentAgents.length > RECENT_MAX) {
          recentAgents = recentAgents.slice(recentAgents.length - RECENT_MAX);
        }
        persistState();
        return { restored: recentAgents.length, interrupted: interruptedCount };
      }
      return {
        spawn,
        update,
        complete,
        fail,
        get,
        getActive,
        getRecent,
        getAll,
        markInterrupted,
        loadFromDisk,
        restoreFromDisk
      };
    }
    if (require.main === module2) {
      const reg = createAgentRegistry(".", () => {
      });
      const a = reg.spawn("execution", "A-01", "M-01");
      console.log("spawned:", a.id, a.status);
      reg.complete(a.id, { path: "test.md" });
      console.log("completed:", reg.get(a.id).status);
      console.log("active:", reg.getActive().length);
      console.log("recent:", reg.getRecent().length);
      const restored = reg.restoreFromDisk();
      console.log("restored:", restored.restored, "interrupted:", restored.interrupted);
      console.log("OK");
    }
    module2.exports = { createAgentRegistry };
  }
});

// src/server/index.js
var require_server = __commonJS({
  "src/server/index.js"(exports2, module2) {
    "use strict";
    var http = require("node:http");
    var fs = require("node:fs");
    var net = require("node:net");
    var path = require("node:path");
    var { runLoadGraph: runLoadGraph2 } = require_load_graph();
    var { runStatus: runStatus2 } = require_status();
    var { runGetExecPlan: runGetExecPlan2 } = require_get_exec_plan();
    var { runAddDeclaration: runAddDeclaration2 } = require_add_declaration();
    var { runUpdateDeclaration: runUpdateDeclaration2 } = require_update_declaration();
    var { runDeleteDeclaration: runDeleteDeclaration2 } = require_delete_declaration();
    var { createProcessManager } = require_process_manager();
    var { createDerivationRunner } = require_derivation_runner();
    var { createActionDerivationRunner } = require_action_derivation_runner();
    var { createRevisionRunner } = require_revision_runner();
    var { runAddMilestonesBatch: runAddMilestonesBatch2 } = require_add_milestones_batch();
    var { buildDagFromDisk } = require_build_dag();
    var { computeWorkabilityPath, VALID_REVIEW_STATES } = require_engine();
    var { findMilestoneFolder } = require_milestone_folders();
    var { parseFutureFile, writeFutureFile } = require_future();
    var { parsePlanFile, writePlanFile, updateActionStatus } = require_plan();
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { computeWorkflowState } = require_workflow_state();
    var { createPlayRunner } = require_play();
    var { computeReadiness } = require_readiness();
    var { computeLifecycleStages } = require_lifecycle_stages();
    var { createPipelineRunner } = require_pipeline_runner();
    var { createAgentRegistry } = require_agent_registry();
    var MIME_TYPES = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon"
    };
    function getPublicDir(cwd) {
      const installed = path.join(cwd, ".claude", "server", "public");
      if (fs.existsSync(installed)) return installed;
      const bundled = path.join(__dirname, "public");
      if (fs.existsSync(bundled)) return bundled;
      return path.join(cwd, "src", "server", "public");
    }
    function sendJson(res, statusCode, data) {
      const body = JSON.stringify(data, null, 2);
      res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end(body);
    }
    function readJsonBody(req) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        const MAX_SIZE = 64 * 1024;
        req.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_SIZE) {
            reject(new Error("Request body too large (max 64KB)"));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        req.on("end", () => {
          try {
            const raw = Buffer.concat(chunks).toString("utf-8");
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(new Error("Invalid JSON body"));
          }
        });
        req.on("error", reject);
      });
    }
    function sendFile(res, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": data.length,
          "Cache-Control": "no-cache, no-store, must-revalidate"
        });
        res.end(data);
      });
    }
    function handleGraph(res, cwd) {
      try {
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        sendJson(res, 200, graph);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleStatus(res, cwd) {
      try {
        const status = runStatus2(cwd);
        if ("error" in status) {
          sendJson(res, 500, { error: status.error });
          return;
        }
        sendJson(res, 200, status);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleMilestone(res, cwd, milestoneId) {
      try {
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const normalizedId = milestoneId.toUpperCase();
        const milestone = graph.milestones.find(
          (m) => m.id.toUpperCase() === normalizedId
        );
        if (!milestone) {
          sendJson(res, 404, { error: `Milestone '${milestoneId}' not found` });
          return;
        }
        const milestoneActions = graph.actions.filter((a) => {
          if (Array.isArray(a.causes)) {
            return a.causes.some((c) => c.toUpperCase() === normalizedId);
          }
          return false;
        });
        sendJson(res, 200, {
          milestone,
          actions: milestoneActions
        });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleMilestoneLog(res, cwd, milestoneId) {
      const planningDir = path.join(cwd, ".planning");
      const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
      if (!milestoneFolder) {
        sendJson(res, 404, { error: "Milestone folder not found" });
        return;
      }
      const logPath = path.join(milestoneFolder, "execution.log");
      fs.readFile(logPath, "utf-8", (err, data) => {
        if (err) {
          res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
          });
          res.end("");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Length": Buffer.byteLength(data),
          "Access-Control-Allow-Origin": "*"
        });
        res.end(data);
      });
    }
    function handleWorkability(res, cwd, nodeId) {
      try {
        const result = buildDagFromDisk(cwd);
        if ("error" in result && !("dag" in result)) {
          sendJson(res, 500, { error: result.error });
          return;
        }
        const { dag } = result;
        const normalizedId = nodeId.toUpperCase();
        if (!dag.getNode(normalizedId)) {
          sendJson(res, 404, { error: `Node '${nodeId}' not found` });
          return;
        }
        const path2 = computeWorkabilityPath(dag, normalizedId);
        sendJson(res, 200, path2);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleWorkflowState(res, cwd) {
      try {
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const pm = getProcessManager(cwd);
        const runningIds = new Set(pm.running());
        const result = computeWorkflowState(graph, runningIds);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleLifecycle(res, cwd) {
      try {
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const pm = getProcessManager(cwd);
        const runningIds = new Set(pm.running());
        const result = computeLifecycleStages(graph, runningIds);
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    async function handleSaveManifest(req, res, cwd) {
      try {
        const body = await readJsonBody(req);
        if (!body || !Array.isArray(body.waves) || body.waves.length === 0) {
          sendJson(res, 400, { error: "waves must be a non-empty array" });
          return;
        }
        for (let i = 0; i < body.waves.length; i++) {
          const wave = body.waves[i];
          if (!Array.isArray(wave.milestones)) {
            sendJson(res, 400, { error: `waves[${i}].milestones must be an array` });
            return;
          }
          for (let j = 0; j < wave.milestones.length; j++) {
            const m = wave.milestones[j];
            if (typeof m.id !== "string" || !m.id) {
              sendJson(res, 400, { error: `waves[${i}].milestones[${j}].id must be a non-empty string` });
              return;
            }
            if (!Array.isArray(m.actions)) {
              sendJson(res, 400, { error: `waves[${i}].milestones[${j}].actions must be an array` });
              return;
            }
          }
        }
        const manifest = {
          waves: body.waves,
          confirmedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        const manifestPath = path.join(cwd, ".planning", "execution-manifest.json");
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, 400, { error: String(err) });
      }
    }
    function handleGetManifest(res, cwd) {
      try {
        const manifestPath = path.join(cwd, ".planning", "execution-manifest.json");
        if (!fs.existsSync(manifestPath)) {
          sendJson(res, 404, { error: "No execution manifest found" });
          return;
        }
        const data = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        sendJson(res, 200, data);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleReadiness(res, cwd) {
      try {
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        sendJson(res, 200, graph.readiness || {});
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleActivity(res, cwd) {
      const activityFile = path.join(cwd, ".planning", "activity.jsonl");
      if (!fs.existsSync(activityFile)) {
        sendJson(res, 200, { events: [] });
        return;
      }
      try {
        const lines = fs.readFileSync(activityFile, "utf-8").split("\n").filter(Boolean).slice(-100);
        const events = lines.map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        }).filter(Boolean).reverse();
        sendJson(res, 200, { events });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleFileContent(req, res, cwd) {
      try {
        const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
        const requestedPath = parsedUrl.searchParams.get("path");
        if (!requestedPath) {
          sendJson(res, 400, { error: "Missing 'path' query parameter" });
          return;
        }
        const resolvedPath = path.resolve(cwd, requestedPath);
        if (resolvedPath !== cwd && !resolvedPath.startsWith(cwd + path.sep)) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        if (!fs.existsSync(resolvedPath)) {
          sendJson(res, 404, { error: "File not found" });
          return;
        }
        if (fs.statSync(resolvedPath).isDirectory()) {
          sendJson(res, 400, { error: "Path is a directory" });
          return;
        }
        const fileContent = fs.readFileSync(resolvedPath, "utf-8");
        sendJson(res, 200, { path: requestedPath, content: fileContent });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleExecuteAction(res, cwd, actionId) {
      try {
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const normalizedId = actionId.toUpperCase();
        const action = graph.actions.find((a) => a.id.toUpperCase() === normalizedId);
        if (!action) {
          sendJson(res, 404, { error: "Action not found" });
          return;
        }
        if (action.reviewState !== "approved") {
          sendJson(res, 403, {
            error: "Action not approved for execution",
            unapproved: [{ id: action.id, title: action.title, reviewState: action.reviewState || "draft" }]
          });
          return;
        }
        const milestoneId = (action.causes || []).find((c) => c.startsWith("M-")) || (action.causes || [])[0] || actionId;
        const milestone = graph.milestones.find((m) => m.id === milestoneId);
        const declaration = milestone ? (graph.declarations || []).find((d) => (milestone.realizes || []).includes(d.id)) : null;
        const siblingActions = graph.actions.filter(
          (a) => a.id !== action.id && (a.causes || []).includes(milestoneId)
        );
        const actionContext = {
          action: { id: action.id, title: action.title, produces: action.produces || "", status: action.status },
          milestone: milestone ? { id: milestone.id, title: milestone.title, description: milestone.description || "" } : null,
          declaration: declaration ? { id: declaration.id, statement: declaration.statement || declaration.title || "" } : null,
          siblingActions: siblingActions.map((a) => ({ id: a.id, title: a.title, produces: a.produces || "", status: a.status }))
        };
        const pm = getProcessManager(cwd);
        const execResult = pm.execute(actionId, milestoneId, actionContext);
        if (execResult.error) {
          sendJson(res, execResult.status || 500, { error: execResult.error });
          return;
        }
        sendJson(res, 202, { ok: true, actionId });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    async function handleDerive(req, res, cwd) {
      try {
        const body = await readJsonBody(req);
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const declarations = graph.declarations.map((d) => ({
          id: d.id,
          statement: d.statement,
          milestones: d.milestones || []
        }));
        const dr = getDerivationRunner(cwd);
        const declarationId = body.declarationId || null;
        const result = dr.derive(declarationId, declarations);
        if (result.error) {
          sendJson(res, result.status || 500, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true, sessionId: result.sessionId, declarationId });
      } catch (err) {
        sendJson(res, 400, { error: String(err) });
      }
    }
    function handleDeriveStop(req, res, cwd) {
      const dr = getDerivationRunner(cwd);
      let sessionId;
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          sessionId = body.sessionId;
        } catch (_) {
        }
        const result = dr.stop(sessionId);
        if (result.error) {
          sendJson(res, result.status || 500, { error: result.error });
        } else {
          sendJson(res, 200, { ok: true });
        }
      });
    }
    async function handleDeriveAccept(req, res, cwd) {
      try {
        const body = await readJsonBody(req);
        if (!body.milestones || !Array.isArray(body.milestones) || body.milestones.length === 0) {
          sendJson(res, 400, { error: "Missing or empty milestones array" });
          return;
        }
        const result = runAddMilestonesBatch2(cwd, ["--json", JSON.stringify(body.milestones)]);
        if ("error" in result) {
          sendJson(res, 400, { error: result.error });
          return;
        }
        sendJson(res, 200, result);
        broadcastChange();
      } catch (err) {
        sendJson(res, 400, { error: String(err) });
      }
    }
    function handleDeriveAll(res, cwd) {
      try {
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const declarations = graph.declarations.map((d) => ({
          id: d.id,
          statement: d.statement,
          milestones: d.milestones || []
        }));
        const needsPlanning = declarations.filter((d) => !d.milestones || d.milestones.length === 0);
        if (needsPlanning.length === 0) {
          sendJson(res, 200, { ok: true, sessions: [], message: "All declarations already have milestones" });
          return;
        }
        const dr = getDerivationRunner(cwd);
        const results = [];
        for (const decl of needsPlanning) {
          const result = dr.derive(decl.id, declarations);
          if (result.ok) {
            results.push({ declarationId: decl.id, sessionId: result.sessionId });
          }
        }
        sendJson(res, 202, { ok: true, sessions: results });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleActionDerive(res, cwd, milestoneId) {
      try {
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const normalizedId = milestoneId.toUpperCase();
        const milestone = graph.milestones.find(
          (m) => m.id.toUpperCase() === normalizedId
        );
        if (!milestone) {
          sendJson(res, 404, { error: `Milestone '${milestoneId}' not found` });
          return;
        }
        const existingActions = graph.actions.filter(
          (a) => (a.causes || []).some((c) => c.toUpperCase() === normalizedId)
        );
        const adr = getActionDerivationRunner(cwd);
        const result = adr.derive(
          { id: milestone.id, title: milestone.title, status: milestone.status, realizes: milestone.realizes || [] },
          existingActions.map((a) => ({ id: a.id, title: a.title, status: a.status, produces: a.produces || "" }))
        );
        if (result.error) {
          sendJson(res, result.status || 500, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true, sessionId: result.sessionId });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleActionDeriveStop(res, cwd) {
      const adr = getActionDerivationRunner(cwd);
      const result = adr.stop();
      if (result.error) {
        sendJson(res, result.status || 500, { error: result.error });
      } else {
        sendJson(res, 200, { ok: true });
      }
    }
    async function handleActionDeriveAccept(req, res, cwd, milestoneId) {
      try {
        const body = await readJsonBody(req);
        if (!body.actions || !Array.isArray(body.actions) || body.actions.length === 0) {
          sendJson(res, 400, { error: "Missing or empty actions array" });
          return;
        }
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const normalizedId = milestoneId.toUpperCase();
        const milestone = graph.milestones.find(
          (m) => m.id.toUpperCase() === normalizedId
        );
        if (!milestone) {
          sendJson(res, 404, { error: `Milestone '${milestoneId}' not found` });
          return;
        }
        const planningDir = path.join(cwd, ".planning");
        const milestoneFolder = findMilestoneFolder(planningDir, milestone.id);
        let existingActions = [];
        let planContent = "";
        const planPath = milestoneFolder ? path.join(milestoneFolder, "PLAN.md") : null;
        if (planPath && fs.existsSync(planPath)) {
          planContent = fs.readFileSync(planPath, "utf-8");
          const parsed = parsePlanFile(planContent);
          existingActions = parsed.actions || [];
        }
        let maxActionNum = 0;
        for (const a of graph.actions) {
          const num = parseInt(a.id.split("-")[1], 10);
          if (!isNaN(num) && num > maxActionNum) maxActionNum = num;
        }
        const newActions = [];
        for (const input of body.actions) {
          maxActionNum++;
          const id = `A-${maxActionNum < 10 ? "0" + maxActionNum : maxActionNum}`;
          newActions.push({
            id,
            title: input.title,
            status: "PENDING",
            produces: input.produces || ""
          });
        }
        const allActions = [...existingActions, ...newActions];
        const { ensureMilestoneFolder } = require_milestone_folders();
        const folder = ensureMilestoneFolder(planningDir, milestone.id, milestone.title);
        const targetPlanPath = path.join(folder, "PLAN.md");
        const realizes = milestone.realizes || [];
        const output = writePlanFile(milestone.id, milestone.title, realizes, allActions);
        fs.writeFileSync(targetPlanPath, output, "utf-8");
        const milestonesPath = path.join(planningDir, "MILESTONES.md");
        if (fs.existsSync(milestonesPath)) {
          let milestonesContent = fs.readFileSync(milestonesPath, "utf-8");
          const rowPattern = new RegExp(`(\\|\\s*${milestone.id}\\s*\\|.*?)\\s*NO\\s*\\|\\s*$`, "m");
          if (rowPattern.test(milestonesContent)) {
            milestonesContent = milestonesContent.replace(rowPattern, "$1 YES |");
            fs.writeFileSync(milestonesPath, milestonesContent, "utf-8");
          }
        }
        sendJson(res, 200, {
          actions: newActions,
          milestoneId: milestone.id
        });
        broadcastChange();
      } catch (err) {
        sendJson(res, 400, { error: String(err) });
      }
    }
    function setReviewState(cwd, nodeId, reviewState) {
      if (!reviewState || !VALID_REVIEW_STATES.has(reviewState)) {
        return { error: `Invalid reviewState. Must be one of: ${[...VALID_REVIEW_STATES].join(", ")}`, status: 400 };
      }
      const id = nodeId.toUpperCase();
      const prefix = id.split("-")[0];
      const planningDir = path.join(cwd, ".planning");
      if (prefix === "D") {
        const futurePath = path.join(planningDir, "FUTURE.md");
        if (!fs.existsSync(futurePath)) return { error: "FUTURE.md not found", status: 404 };
        const content = fs.readFileSync(futurePath, "utf-8");
        const declarations = parseFutureFile(content);
        const decl = declarations.find((d) => d.id === id);
        if (!decl) return { error: `Declaration ${id} not found`, status: 404 };
        decl.reviewState = reviewState;
        const headerMatch = content.match(/^# Future: (.+)/m);
        const projectName = headerMatch ? headerMatch[1].trim() : "Project";
        fs.writeFileSync(futurePath, writeFutureFile(declarations, projectName), "utf-8");
      } else if (prefix === "M") {
        const milestonesPath = path.join(planningDir, "MILESTONES.md");
        if (!fs.existsSync(milestonesPath)) return { error: "MILESTONES.md not found", status: 404 };
        const content = fs.readFileSync(milestonesPath, "utf-8");
        const { milestones } = parseMilestonesFile(content);
        const mile = milestones.find((m) => m.id === id);
        if (!mile) return { error: `Milestone ${id} not found`, status: 404 };
        mile.reviewState = reviewState;
        const nameMatch = content.match(/^# Milestones:\s*(.+)/m);
        const pName = nameMatch ? nameMatch[1].trim() : "Project";
        fs.writeFileSync(milestonesPath, writeMilestonesFile(milestones, pName), "utf-8");
      } else if (prefix === "A") {
        const milestonesDir = path.join(planningDir, "milestones");
        if (!fs.existsSync(milestonesDir)) return { error: "No milestones directory", status: 404 };
        let found = false;
        const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
          const planPath = path.join(milestonesDir, entry.name, "PLAN.md");
          if (!fs.existsSync(planPath)) continue;
          const content = fs.readFileSync(planPath, "utf-8");
          const parsed = parsePlanFile(content);
          const action = parsed.actions.find((a) => a.id === id);
          if (!action) continue;
          const lines = content.split("\n");
          let inSection = false;
          let patched = false;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("### ")) {
              inSection = lines[i].startsWith(`### ${id}:`);
            }
            if (inSection && !patched && /^\*\*Review:\*\*/i.test(lines[i].trim())) {
              lines[i] = `**Review:** ${reviewState}`;
              patched = true;
              break;
            }
            if (inSection && !patched && /^\*\*Status:\*\*/i.test(lines[i].trim())) {
              if (i + 1 < lines.length && /^\*\*Review:\*\*/i.test(lines[i + 1].trim())) {
                lines[i + 1] = `**Review:** ${reviewState}`;
                patched = true;
              } else {
                lines.splice(i + 1, 0, `**Review:** ${reviewState}`);
                patched = true;
              }
              break;
            }
          }
          if (patched) {
            fs.writeFileSync(planPath, lines.join("\n"), "utf-8");
            found = true;
          }
          break;
        }
        if (!found) return { error: `Action ${id} not found in any PLAN.md`, status: 404 };
      } else {
        return { error: `Unknown node type prefix: ${prefix}`, status: 400 };
      }
      return { ok: true, id, reviewState };
    }
    async function handleUpdateReviewState(req, res, cwd, nodeId) {
      try {
        const body = await readJsonBody(req);
        const result = setReviewState(cwd, nodeId, body.reviewState);
        if ("error" in result) {
          sendJson(res, result.status || 500, { error: result.error });
          return;
        }
        try {
          const activityFile = path.join(cwd, ".planning", "activity.jsonl");
          const entry = {
            ts: (/* @__PURE__ */ new Date()).toISOString(),
            tool: "Review",
            phase: "end",
            desc: body.reviewState === "approved" ? `Approved ${nodeId}` : `Revision needed: ${nodeId}`,
            nodeId,
            reviewState: body.reviewState
          };
          fs.appendFileSync(activityFile, JSON.stringify(entry) + "\n");
        } catch (_) {
        }
        sendJson(res, 200, result);
        broadcastChange();
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function getAnnotationsPath(cwd, nodeId) {
      return path.join(cwd, ".planning", "annotations", `${nodeId.toUpperCase()}.json`);
    }
    function readAnnotations(cwd, nodeId) {
      const filePath = getAnnotationsPath(cwd, nodeId);
      if (!fs.existsSync(filePath)) {
        return { nodeId: nodeId.toUpperCase(), annotations: [], revisionRound: 0 };
      }
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        data.revisionRound = data.revisionRound || 0;
        return data;
      } catch (_) {
        return { nodeId: nodeId.toUpperCase(), annotations: [], revisionRound: 0 };
      }
    }
    function writeAnnotations(cwd, nodeId, data) {
      const filePath = getAnnotationsPath(cwd, nodeId);
      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    }
    function handleGetAnnotations(res, cwd, nodeId) {
      try {
        const data = readAnnotations(cwd, nodeId);
        sendJson(res, 200, data);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    async function handleAddAnnotation(req, res, cwd, nodeId) {
      try {
        const body = await readJsonBody(req);
        const { line, text } = body;
        if (typeof line !== "number" || line < 1) {
          sendJson(res, 400, { error: "line must be a number >= 1" });
          return;
        }
        if (typeof text !== "string" || text.trim().length === 0) {
          sendJson(res, 400, { error: "text must be a non-empty string" });
          return;
        }
        const id = "ann-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        const annotation = {
          id,
          line,
          text: text.trim(),
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          resolved: false
        };
        const data = readAnnotations(cwd, nodeId);
        data.annotations.push(annotation);
        writeAnnotations(cwd, nodeId, data);
        setReviewState(cwd, nodeId, "revision_needed");
        broadcastChange();
        sendJson(res, 201, annotation);
      } catch (err) {
        sendJson(res, 400, { error: String(err) });
      }
    }
    function handleDeleteAnnotation(res, cwd, nodeId, annotationId) {
      try {
        const data = readAnnotations(cwd, nodeId);
        const before = data.annotations.length;
        data.annotations = data.annotations.filter((a) => a.id !== annotationId);
        if (data.annotations.length === before) {
          sendJson(res, 404, { error: "Annotation not found" });
          return;
        }
        writeAnnotations(cwd, nodeId, data);
        broadcastChange();
        sendJson(res, 200, { ok: true, id: annotationId });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleIncrementRevisionRound(res, cwd, nodeId) {
      try {
        const data = readAnnotations(cwd, nodeId);
        data.revisionRound = (data.revisionRound || 0) + 1;
        writeAnnotations(cwd, nodeId, data);
        broadcastChange();
        sendJson(res, 200, { ok: true, revisionRound: data.revisionRound });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    var sseClients = /* @__PURE__ */ new Set();
    var agentRegistry = null;
    function getAgentRegistry(cwd) {
      if (!agentRegistry) {
        agentRegistry = createAgentRegistry(cwd, (event, data) => {
          const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
          for (const client of sseClients) {
            try {
              client.write(payload);
            } catch (_) {
              sseClients.delete(client);
            }
          }
        });
      }
      return agentRegistry;
    }
    var processManager = null;
    function getProcessManager(cwd) {
      if (!processManager) processManager = createProcessManager(sseClients, cwd, getAgentRegistry(cwd));
      return processManager;
    }
    var derivationRunner = null;
    function getDerivationRunner(cwd) {
      if (!derivationRunner) derivationRunner = createDerivationRunner(sseClients, cwd, getAgentRegistry(cwd));
      return derivationRunner;
    }
    var actionDerivationRunner = null;
    function getActionDerivationRunner(cwd) {
      if (!actionDerivationRunner) actionDerivationRunner = createActionDerivationRunner(sseClients, cwd, getAgentRegistry(cwd));
      return actionDerivationRunner;
    }
    var playRunner = null;
    function getPlayRunner(cwd) {
      if (!playRunner) playRunner = createPlayRunner(sseClients, cwd);
      return playRunner;
    }
    var pipelineRunnerInstance = null;
    function getPipelineRunner(cwd) {
      if (!pipelineRunnerInstance) pipelineRunnerInstance = createPipelineRunner(sseClients, cwd, getAgentRegistry(cwd));
      return pipelineRunnerInstance;
    }
    var revisionRunner = null;
    function getRevisionRunner(cwd) {
      if (!revisionRunner) {
        revisionRunner = createRevisionRunner(sseClients, cwd, (nodeId) => {
          setReviewState(cwd, nodeId, "in_review");
          broadcastChange();
        }, getAgentRegistry(cwd));
      }
      return revisionRunner;
    }
    function broadcastChange() {
      for (const client of sseClients) {
        try {
          client.write("event: change\ndata: {}\n\n");
        } catch (_) {
          sseClients.delete(client);
        }
      }
    }
    function watchPlanning(cwd) {
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) return;
      let graphTimer = null;
      let activityTimer = null;
      const activityFile = path.join(planningDir, "activity.jsonl");
      try {
        fs.watch(planningDir, { recursive: true }, (_evt, filename) => {
          if (filename && filename.endsWith("activity.jsonl")) {
            if (activityTimer) clearTimeout(activityTimer);
            activityTimer = setTimeout(() => {
              for (const client of sseClients) {
                try {
                  client.write("event: activity\ndata: {}\n\n");
                } catch {
                  sseClients.delete(client);
                }
              }
              activityTimer = null;
            }, 50);
          } else {
            if (graphTimer) clearTimeout(graphTimer);
            graphTimer = setTimeout(() => {
              broadcastChange();
              graphTimer = null;
            }, 200);
          }
        });
      } catch (_) {
      }
    }
    function handleGetRevisions(res, cwd, nodeId) {
      try {
        const id = nodeId.toUpperCase();
        const prefix = id.split("-")[0];
        const planningDir = path.join(cwd, ".planning");
        let artifactPath = null;
        if (prefix === "D") {
          artifactPath = path.join(planningDir, "FUTURE.md");
        } else if (prefix === "M") {
          const folder = findMilestoneFolder(planningDir, id);
          if (folder) artifactPath = path.join(folder, "PLAN.md");
        } else if (prefix === "A") {
          const graph = runLoadGraph2(cwd);
          if (!("error" in graph)) {
            const action = graph.actions.find((a) => a.id.toUpperCase() === id);
            if (action) {
              const milestoneId = (action.causes || [])[0];
              if (milestoneId) {
                const folder = findMilestoneFolder(planningDir, milestoneId);
                if (folder) {
                  const aNum = id.replace(/^A-/, "");
                  artifactPath = path.join(folder, `A-${aNum}-EXEC-PLAN.md`);
                  if (!fs.existsSync(artifactPath)) {
                    artifactPath = path.join(folder, "PLAN.md");
                  }
                }
              }
            }
          }
        }
        if (!artifactPath || !fs.existsSync(artifactPath)) {
          sendJson(res, 404, { error: "Artifact not found for node " + id });
          return;
        }
        const current = fs.readFileSync(artifactPath, "utf-8");
        const annData = readAnnotations(cwd, id);
        const revisionRound = annData.revisionRound || 0;
        let previous = null;
        if (revisionRound >= 1) {
          const prevRound = revisionRound - 1;
          const prevPath = artifactPath.replace(".md", "") + ".v" + prevRound + ".md";
          if (fs.existsSync(prevPath)) {
            previous = fs.readFileSync(prevPath, "utf-8");
          }
        }
        sendJson(res, 200, { current, previous, revisionRound });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    async function handleRevise(req, res, cwd, nodeId) {
      try {
        const id = nodeId.toUpperCase();
        const prefix = id.split("-")[0];
        const planningDir = path.join(cwd, ".planning");
        let artifactPath = null;
        if (prefix === "D") {
          artifactPath = path.join(planningDir, "FUTURE.md");
        } else if (prefix === "M") {
          const folder = findMilestoneFolder(planningDir, id);
          if (folder) artifactPath = path.join(folder, "PLAN.md");
        } else if (prefix === "A") {
          const graph = runLoadGraph2(cwd);
          if (!("error" in graph)) {
            const action = graph.actions.find((a) => a.id.toUpperCase() === id);
            if (action) {
              const milestoneId = (action.causes || [])[0];
              if (milestoneId) {
                const folder = findMilestoneFolder(planningDir, milestoneId);
                if (folder) {
                  const aNum = id.replace(/^A-/, "");
                  artifactPath = path.join(folder, `A-${aNum}-EXEC-PLAN.md`);
                  if (!fs.existsSync(artifactPath)) {
                    artifactPath = path.join(folder, "PLAN.md");
                  }
                }
              }
            }
          }
        }
        if (!artifactPath || !fs.existsSync(artifactPath)) {
          sendJson(res, 404, { error: "Artifact not found for node " + id });
          return;
        }
        const artifactContent = fs.readFileSync(artifactPath, "utf-8");
        const annData = readAnnotations(cwd, id);
        const annotations = annData.annotations || [];
        if (annotations.length === 0) {
          sendJson(res, 400, { error: "no_annotations" });
          return;
        }
        const rr = getRevisionRunner(cwd);
        const result = rr.revise(id, artifactPath, artifactContent, annotations);
        if (result.error) {
          sendJson(res, result.status || 500, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true, sessionId: result.sessionId });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleReviseStop(res, cwd) {
      const rr = getRevisionRunner(cwd);
      const result = rr.stop();
      if (result.error) {
        sendJson(res, result.status || 500, { error: result.error });
      } else {
        sendJson(res, 200, { ok: true });
      }
    }
    var refineSessions = /* @__PURE__ */ new Map();
    function buildRefinePrompt(nodeId, graph, mode, userMessage) {
      const id = nodeId.toUpperCase();
      const prefix = id.split("-")[0];
      let nodeContent = "";
      let parentContent = "";
      let siblingsContent = "";
      let nodeType = "";
      if (prefix === "D") {
        nodeType = "declaration";
        const decl = graph.declarations.find((d) => d.id.toUpperCase() === id);
        if (!decl) return null;
        nodeContent = `${decl.id}: ${decl.title}
Statement: ${decl.statement || decl.title}`;
        siblingsContent = graph.declarations.filter((d) => d.id !== decl.id).map((d) => `${d.id}: ${d.title}`).join("\n");
        parentContent = "This is a top-level declaration (no parent).";
      } else if (prefix === "M") {
        nodeType = "milestone";
        const mile = graph.milestones.find((m) => m.id.toUpperCase() === id);
        if (!mile) return null;
        nodeContent = `${mile.id}: ${mile.title}
Produces: ${mile.produces || "(none)"}`;
        const parentDecls = graph.declarations.filter((d) => (mile.realizes || []).some((r) => r === d.id));
        parentContent = parentDecls.map((d) => `${d.id}: ${d.title}
Statement: ${d.statement || d.title}`).join("\n\n");
        const siblingMiles = graph.milestones.filter((m) => m.id !== mile.id && (mile.realizes || []).some((r) => (m.realizes || []).includes(r)));
        siblingsContent = siblingMiles.map((m) => `${m.id}: ${m.title} [${m.status}]`).join("\n");
      } else if (prefix === "A") {
        nodeType = "action";
        const action = graph.actions.find((a) => a.id.toUpperCase() === id);
        if (!action) return null;
        nodeContent = `${action.id}: ${action.title}
Produces: ${action.produces || "(none)"}`;
        const parentMiles = graph.milestones.filter((m) => (action.causes || []).includes(m.id));
        parentContent = parentMiles.map((m) => `${m.id}: ${m.title}
Produces: ${m.produces || "(none)"}`).join("\n\n");
        const milestoneIds = action.causes || [];
        const siblingActions = graph.actions.filter((a) => a.id !== action.id && (a.causes || []).some((c) => milestoneIds.includes(c)));
        siblingsContent = siblingActions.map((a) => `${a.id}: ${a.title} [${a.status}]`).join("\n");
      }
      const modeInstructions = {
        write: `The user wants to modify this ${nodeType} with specific direction:

"${userMessage || ""}"

You have tool access \u2014 directly edit the project files to apply the requested changes. The planning files are at:
- ${nodeType === "declaration" ? "FUTURE.md" : nodeType === "milestone" ? "MILESTONES.md" : "the milestone PLAN.md"}
- MILESTONES.md (for milestone references)
- FUTURE-ARCHIVE.md (if archiving)

Apply the changes directly. After making edits, summarize what you changed.`,
        outdated: `Check if this ${nodeType} is still relevant given the current state of its parent and siblings. Some siblings may already be DONE. Consider:
- Has progress on siblings made this redundant?
- Does the title/statement still accurately describe what's needed?
- Should this be reworded to reflect current reality?`,
        sharpen: `Make this ${nodeType} more specific and actionable. Consider:
- Is the title vague or generic? Make it concrete.
- Does the statement/produces describe a clear, verifiable outcome?
- Could someone read this and know exactly what "done" looks like?`,
        consolidate: `Check if this ${nodeType} overlaps with its siblings. Consider:
- Are any siblings covering the same ground?
- Could this be merged with a sibling for clarity?
- Is this a subset of another sibling?

If overlap exists, suggest how to differentiate or merge. If no overlap, say so.`,
        expand: `This ${nodeType} may be too broad. Consider:
- Could it be broken into 2-3 more specific items?
- Are there implicit sub-tasks hiding in the description?
- Would splitting improve clarity and trackability?

Suggest a breakdown if warranted. If it's already well-scoped, say so.`
      };
      const taskBlock = modeInstructions[mode] || `Analyze this ${nodeType} in the context of its parent and siblings. Consider:
- Is it well-scoped? Too broad or too narrow compared to siblings?
- Does it overlap with any sibling?
- Does it clearly contribute to its parent's goal?
- Is the title/statement clear and specific?`;
      return `You are reviewing a Declare project artifact and suggesting improvements.

## This ${nodeType}

${nodeContent}

## Parent context

${parentContent}

## Sibling ${nodeType === "declaration" ? "declarations" : nodeType === "milestone" ? "milestones" : "actions"}

${siblingsContent || "(none)"}

## Task

${taskBlock}

If improvements are possible, suggest a revised version. Output ONLY the improved text in this format:

**Title:** <improved title>
**Statement:** <improved statement or produces>
**Reason:** <one sentence explaining why this is better>

If the current version is already good, output exactly: LGTM \u2014 no changes needed.`;
    }
    async function handleRefine(req, res, cwd, nodeId) {
      try {
        const body = await readJsonBody(req).catch(() => ({}));
        const mode = body.mode || "general";
        const userMessage = body.message || "";
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const prompt = buildRefinePrompt(nodeId, graph, mode, userMessage);
        if (!prompt) {
          sendJson(res, 404, { error: "Node not found: " + nodeId });
          return;
        }
        const sessionId = `refine-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const { runAI } = require_ai_runner();
        const activityFile = path.join(cwd, ".planning", "activity.jsonl");
        const nId = nodeId.toUpperCase();
        let refineAgentId;
        try {
          const reg = getAgentRegistry(cwd);
          const agent = reg.spawn("refine", nId, nId);
          refineAgentId = agent.id;
        } catch (_) {
        }
        const abortController = new AbortController();
        refineSessions.set(sessionId, { sessionId, nodeId: nId, suggestion: "", abortController, agentId: refineAgentId });
        const isWriteMode = mode === "write";
        runAI(prompt, {
          cwd,
          model: "haiku",
          maxTurns: isWriteMode ? 10 : 1,
          withTools: isWriteMode,
          abortController,
          onText: (text) => {
            const session = refineSessions.get(sessionId);
            if (session) session.suggestion += text;
            const payload = `event: refine-output
data: ${JSON.stringify({ sessionId, nodeId: nId, text })}

`;
            for (const client of sseClients) {
              try {
                client.write(payload);
              } catch (_) {
                sseClients.delete(client);
              }
            }
          }
        }).then(({ text, error }) => {
          const session = refineSessions.get(sessionId);
          const suggestion = text || (session ? session.suggestion : "");
          refineSessions.delete(sessionId);
          const exitCode = error ? 1 : 0;
          const payload = `event: refine-complete
data: ${JSON.stringify({ sessionId, nodeId: nId, exitCode, suggestion, error })}

`;
          for (const client of sseClients) {
            try {
              client.write(payload);
            } catch (_) {
              sseClients.delete(client);
            }
          }
          if (refineAgentId) {
            try {
              const reg = getAgentRegistry(cwd);
              if (!error) reg.complete(refineAgentId, { nodeId: nId });
              else reg.fail(refineAgentId, 1, error);
            } catch (_) {
            }
          }
          const phase = error ? "error" : "done";
          const desc = error ? `Review of ${nId} failed: ${error}` : `Review of ${nId} complete` + (suggestion.includes("LGTM") ? " \u2014 no changes needed" : " \u2014 suggestion ready");
          try {
            fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase, agent: "Refine", desc }) + "\n");
          } catch (_) {
          }
        }).catch((err) => {
          refineSessions.delete(sessionId);
          const payload = `event: refine-complete
data: ${JSON.stringify({ sessionId, nodeId: nId, exitCode: 1, suggestion: "", error: String(err) })}

`;
          for (const client of sseClients) {
            try {
              client.write(payload);
            } catch (_) {
              sseClients.delete(client);
            }
          }
          if (refineAgentId) {
            try {
              getAgentRegistry(cwd).fail(refineAgentId, 1, String(err));
            } catch (_) {
            }
          }
        });
        const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase: "start", agent: "Refine", desc: `Analyzing ${nodeId.toUpperCase()} for improvements` };
        fs.appendFileSync(activityFile, JSON.stringify(entry) + "\n");
        sendJson(res, 202, { ok: true, sessionId });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleRefineStop(res, sessionId) {
      if (sessionId) {
        const session = refineSessions.get(sessionId);
        if (!session) {
          sendJson(res, 404, { error: "Session not found" });
          return;
        }
        try {
          session.abortController.abort();
        } catch (_) {
        }
        refineSessions.delete(sessionId);
        sendJson(res, 200, { ok: true });
      } else {
        for (const [id, session] of refineSessions) {
          try {
            session.abortController.abort();
          } catch (_) {
          }
        }
        refineSessions.clear();
        sendJson(res, 200, { ok: true });
      }
    }
    async function handleRefineAccept(req, res, cwd) {
      try {
        const body = await readJsonBody(req);
        const { nodeId, title, statement } = body;
        if (!nodeId) {
          sendJson(res, 400, { error: "Missing nodeId" });
          return;
        }
        const id = nodeId.toUpperCase();
        const prefix = id.split("-")[0];
        const planningDir = path.join(cwd, ".planning");
        if (prefix === "D") {
          const futurePath = path.join(planningDir, "FUTURE.md");
          const content = fs.readFileSync(futurePath, "utf-8");
          const declarations = parseFutureFile(content);
          const decl = declarations.find((d) => d.id === id);
          if (decl) {
            if (title) decl.title = title;
            if (statement) decl.statement = statement;
            const projectNameMatch = content.match(/^# Future:\\s*(.+)/m);
            const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Project";
            fs.writeFileSync(futurePath, writeFutureFile(declarations, projectName), "utf-8");
          }
        } else if (prefix === "M") {
          const msPath = path.join(planningDir, "MILESTONES.md");
          const content = fs.readFileSync(msPath, "utf-8");
          const { milestones } = parseMilestonesFile(content);
          const mile = milestones.find((m) => m.id === id);
          if (mile && title) {
            mile.title = title;
            const projectNameMatch = content.match(/^# Milestones:\\s*(.+)/m);
            const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Project";
            fs.writeFileSync(msPath, writeMilestonesFile(milestones, projectName), "utf-8");
          }
        }
        const activityFile = path.join(cwd, ".planning", "activity.jsonl");
        const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Review", phase: "end", desc: `Refined ${id}`, nodeId: id, reviewState: "approved" };
        fs.appendFileSync(activityFile, JSON.stringify(entry) + "\n");
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    var discussSession = null;
    async function handleDiscuss(req, res, cwd, nodeId) {
      try {
        if (discussSession) {
          sendJson(res, 409, { error: "A discuss session is already running" });
          return;
        }
        const graph = runLoadGraph2(cwd);
        if ("error" in graph) {
          sendJson(res, 500, { error: graph.error });
          return;
        }
        const id = nodeId.toUpperCase();
        const prefix = id.split("-")[0];
        let nodeContext = "";
        if (prefix === "D") {
          const decl = graph.declarations.find((d) => d.id === id);
          if (!decl) {
            sendJson(res, 404, { error: "Declaration not found" });
            return;
          }
          nodeContext = `Declaration ${decl.id}: ${decl.title}
Statement: ${decl.statement || decl.title}`;
          const myMiles = graph.milestones.filter((m) => (m.realizes || []).includes(id));
          if (myMiles.length > 0) {
            nodeContext += "\n\nExisting milestones:\n" + myMiles.map((m) => `- ${m.id}: ${m.title}`).join("\n");
          }
        } else if (prefix === "M") {
          const mile = graph.milestones.find((m) => m.id === id);
          if (!mile) {
            sendJson(res, 404, { error: "Milestone not found" });
            return;
          }
          nodeContext = `Milestone ${mile.id}: ${mile.title}`;
          const myActions = graph.actions.filter((a) => (a.causes || []).includes(id));
          if (myActions.length > 0) {
            nodeContext += "\n\nExisting actions:\n" + myActions.map((a) => `- ${a.id}: ${a.title}`).join("\n");
          }
        }
        const prompt = `You are helping a user plan their software project. You need to identify gray areas and ambiguities that should be resolved BEFORE creating detailed plans.

Given this project artifact:

${nodeContext}

Identify 3-5 important questions that should be answered to avoid wasted work. Focus on:
- Ambiguous scope (what's included vs excluded?)
- Technical decisions that affect the plan
- Dependencies or constraints not mentioned
- Success criteria that need clarification

Output ONLY a JSON array of question objects:
[{"question": "The question text", "context": "Why this matters", "options": ["Option A", "Option B"]}]

The options array is optional \u2014 include it only when there are clear alternatives to choose from.`;
        const sessionId = `discuss-${Date.now()}`;
        const { runAI } = require_ai_runner();
        const activityFile = path.join(cwd, ".planning", "activity.jsonl");
        let agentId;
        try {
          const reg = getAgentRegistry(cwd);
          const agent = reg.spawn("discuss", id, id);
          agentId = agent.id;
        } catch (_) {
        }
        const abortController = new AbortController();
        discussSession = { sessionId, nodeId: id, abortController, agentId };
        runAI(prompt, {
          cwd,
          model: "haiku",
          maxTurns: 1,
          abortController,
          onText: (text) => {
            const payload = `event: discuss-output
data: ${JSON.stringify({ sessionId, nodeId: id, text })}

`;
            for (const client of sseClients) {
              try {
                client.write(payload);
              } catch (_) {
                sseClients.delete(client);
              }
            }
          }
        }).then(({ text, error }) => {
          const closingSession = discussSession;
          discussSession = null;
          let questions = null;
          if (!error && text) {
            try {
              questions = JSON.parse(text.trim());
            } catch (_) {
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                try {
                  questions = JSON.parse(jsonMatch[0]);
                } catch (_2) {
                }
              }
            }
          }
          const payload = `event: discuss-complete
data: ${JSON.stringify({ sessionId, nodeId: id, questions, error })}

`;
          for (const client of sseClients) {
            try {
              client.write(payload);
            } catch (_) {
              sseClients.delete(client);
            }
          }
          if (closingSession && closingSession.agentId) {
            try {
              const reg = getAgentRegistry(cwd);
              if (!error) reg.complete(closingSession.agentId, { nodeId: id, questionCount: Array.isArray(questions) ? questions.length : 0 });
              else reg.fail(closingSession.agentId, 1, error);
            } catch (_) {
            }
          }
          const phase = error ? "error" : "done";
          const desc = error ? `Discuss ${id} failed: ${error}` : `Discuss ${id}: ${Array.isArray(questions) ? questions.length : 0} questions`;
          try {
            fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase, agent: "Discuss", desc }) + "\n");
          } catch (_) {
          }
        }).catch((err) => {
          discussSession = null;
          if (agentId) {
            try {
              getAgentRegistry(cwd).fail(agentId, 1, String(err));
            } catch (_) {
            }
          }
        });
        try {
          fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase: "start", agent: "Discuss", desc: `Analyzing ${id} for discussion` }) + "\n");
        } catch (_) {
        }
        sendJson(res, 202, { ok: true, sessionId });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    async function handleDiscussAnswer(req, res, cwd, nodeId) {
      try {
        const body = await readJsonBody(req);
        const answers = body.answers;
        if (!Array.isArray(answers) || answers.length === 0) {
          sendJson(res, 400, { error: "Missing answers array" });
          return;
        }
        const id = nodeId.toUpperCase();
        const prefix = id.split("-")[0];
        const planningDir = path.join(cwd, ".planning");
        let contextContent = `# Context: ${id}

`;
        contextContent += `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}

`;
        for (const item of answers) {
          contextContent += `## ${item.question}

${item.answer}

`;
        }
        if (prefix === "M") {
          const { ensureMilestoneFolder } = require_milestone_folders();
          const graph = runLoadGraph2(cwd);
          if ("error" in graph) {
            sendJson(res, 500, { error: graph.error });
            return;
          }
          const milestone = graph.milestones.find((m) => m.id === id);
          if (!milestone) {
            sendJson(res, 404, { error: "Milestone not found" });
            return;
          }
          const folder = ensureMilestoneFolder(planningDir, milestone.id, milestone.title);
          const contextPath = path.join(folder, "CONTEXT.md");
          fs.writeFileSync(contextPath, contextContent, "utf-8");
        } else {
          const contextPath = path.join(planningDir, `CONTEXT-${id}.md`);
          fs.writeFileSync(contextPath, contextContent, "utf-8");
        }
        sendJson(res, 200, { ok: true });
        broadcastChange();
      } catch (err) {
        sendJson(res, 400, { error: String(err) });
      }
    }
    var commandSession = null;
    async function handleCommand(req, res, cwd) {
      try {
        if (commandSession) {
          sendJson(res, 409, { error: "A command is already running" });
          return;
        }
        const body = await readJsonBody(req).catch(() => ({}));
        const message = (body.message || "").trim();
        const context = body.context || {};
        if (!message) {
          sendJson(res, 400, { error: "No message provided" });
          return;
        }
        const sessionId = `cmd-${Date.now()}`;
        const { runAI } = require_ai_runner();
        const activityFile = path.join(cwd, ".planning", "activity.jsonl");
        const graph = runLoadGraph2(cwd);
        let contextBlock = "";
        if (!("error" in graph)) {
          if (context.nodeId) {
            const allNodes = [...graph.declarations || [], ...graph.milestones || [], ...graph.actions || []];
            const node = allNodes.find((n) => n.id === context.nodeId);
            if (node) {
              contextBlock = `
Current view is focused on: ${node.id} \u2014 ${node.title || node.statement || ""} (${node.status || "PENDING"})`;
            }
          }
          if (context.nodeIds && context.nodeIds.length > 0) {
            const allNodes = [...graph.declarations || [], ...graph.milestones || [], ...graph.actions || []];
            const visible = context.nodeIds.map((id) => allNodes.find((n) => n.id === id)).filter(Boolean);
            contextBlock += `
Visible nodes:
${visible.map((n) => `- ${n.id}: ${n.title || n.statement || ""} (${n.status || "PENDING"})`).join("\n")}`;
          }
          if (context.viewDescription) {
            contextBlock += `
View: ${context.viewDescription}`;
          }
        }
        const prompt = `You are working on a Declare project. The project planning files are in ${path.join(cwd, ".planning")}/

The user is looking at the dashboard and says: "${message}"
${contextBlock}

The planning files:
- FUTURE.md \u2014 declarations (the "what" the project declares will be true)
- MILESTONES.md \u2014 milestones (checkpoints that realize declarations)
- milestones/M-XX-slug/PLAN.md \u2014 action plans per milestone

Apply the user's request by editing the relevant files. Be concise in your response \u2014 just state what you did.`;
        let agentId;
        try {
          const reg = getAgentRegistry(cwd);
          const agent = reg.spawn("command", context.nodeId || "project", context.nodeId || "project");
          agentId = agent.id;
        } catch (_) {
        }
        const abortController = new AbortController();
        commandSession = { sessionId, abortController, agentId };
        runAI(prompt, {
          cwd,
          model: "sonnet",
          maxTurns: 15,
          withTools: true,
          abortController,
          onText: (text) => {
            const payload = `event: command-output
data: ${JSON.stringify({ sessionId, text })}

`;
            for (const client of sseClients) {
              try {
                client.write(payload);
              } catch (_) {
                sseClients.delete(client);
              }
            }
          }
        }).then(({ text, error }) => {
          commandSession = null;
          const exitCode = error ? 1 : 0;
          const payload = `event: command-complete
data: ${JSON.stringify({ sessionId, exitCode, result: text, error })}

`;
          for (const client of sseClients) {
            try {
              client.write(payload);
            } catch (_) {
              sseClients.delete(client);
            }
          }
          if (agentId) {
            try {
              const reg = getAgentRegistry(cwd);
              if (!error) reg.complete(agentId, { message: message.slice(0, 50) });
              else reg.fail(agentId, 1, error);
            } catch (_) {
            }
          }
          const phase = error ? "error" : "done";
          const desc = error ? `Command failed: ${error}` : `Command complete: ${text.slice(0, 80)}`;
          try {
            fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase, agent: "Command", desc }) + "\n");
          } catch (_) {
          }
        }).catch((err) => {
          commandSession = null;
          if (agentId) {
            try {
              getAgentRegistry(cwd).fail(agentId, 1, String(err));
            } catch (_) {
            }
          }
        });
        try {
          fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase: "start", agent: "Command", desc: message.slice(0, 100) }) + "\n");
        } catch (_) {
        }
        sendJson(res, 202, { ok: true, sessionId });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    var onboardSession = null;
    function persistOnboardSession(cwd) {
      const filePath = path.join(cwd, ".planning", "onboard-session.json");
      if (!onboardSession) {
        try {
          fs.unlinkSync(filePath);
        } catch (_) {
        }
        return;
      }
      try {
        const data = {
          prompt: onboardSession.prompt,
          answers: onboardSession.answers,
          questions: onboardSession.questions,
          proposals: onboardSession.proposals,
          phase: onboardSession.phase,
          approveIndex: onboardSession.approveIndex || 0,
          savedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
      } catch (_) {
      }
    }
    function restoreOnboardSession(cwd) {
      const filePath = path.join(cwd, ".planning", "onboard-session.json");
      try {
        if (!fs.existsSync(filePath)) return false;
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (data.phase === "questions" && !data.questions) return false;
        if (data.phase === "proposals" && !data.proposals) return false;
        onboardSession = {
          prompt: data.prompt,
          answers: data.answers,
          questions: data.questions,
          proposals: data.proposals,
          phase: data.phase,
          approveIndex: data.approveIndex || 0,
          abortController: null
        };
        return true;
      } catch (_) {
        return false;
      }
    }
    async function handleOnboard(req, res, cwd) {
      try {
        if (onboardSession) {
          sendJson(res, 409, { error: "An onboarding session is already running" });
          return;
        }
        const body = await readJsonBody(req);
        const message = (body.message || "").trim();
        if (!message) {
          sendJson(res, 400, { error: "No message provided" });
          return;
        }
        const { runAI } = require_ai_runner();
        const activityFile = path.join(cwd, ".planning", "activity.jsonl");
        const prompt = `You are helping a user plan their software project. They have described their vision:

"${message}"

Identify 3-5 important clarification questions that should be answered before breaking this vision into concrete declarations. Focus on:
- Scope boundaries (what's included vs excluded?)
- Key technical decisions that affect the architecture
- Target users and use cases
- Priority and sequencing preferences
- Success criteria and constraints

Output ONLY a JSON array of question objects:
[{"question": "The question text", "context": "Why this matters for planning", "options": ["Option A", "Option B"]}]

The options array is optional \u2014 include it only when there are clear alternatives to choose from.`;
        let agentId;
        try {
          const reg = getAgentRegistry(cwd);
          const agent = reg.spawn("onboard", "project", "");
          agentId = agent.id;
        } catch (_) {
        }
        const abortController = new AbortController();
        onboardSession = { prompt: message, answers: null, questions: null, proposals: null, phase: "questions", approveIndex: 0, abortController, agentId };
        persistOnboardSession(cwd);
        runAI(prompt, {
          cwd,
          model: "haiku",
          maxTurns: 1,
          abortController,
          onText: (text) => {
            const payload = `event: onboard-output
data: ${JSON.stringify({ text })}

`;
            for (const client of sseClients) {
              try {
                client.write(payload);
              } catch (_) {
                sseClients.delete(client);
              }
            }
          }
        }).then(({ text, error }) => {
          let questions = null;
          if (!error && text) {
            try {
              questions = JSON.parse(text.trim());
            } catch (_) {
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                try {
                  questions = JSON.parse(jsonMatch[0]);
                } catch (_2) {
                }
              }
            }
          }
          if (onboardSession && questions) {
            onboardSession.questions = questions;
            persistOnboardSession(cwd);
          }
          const payload = `event: onboard-questions-complete
data: ${JSON.stringify({ questions, error })}

`;
          for (const client of sseClients) {
            try {
              client.write(payload);
            } catch (_) {
              sseClients.delete(client);
            }
          }
          if (agentId) {
            try {
              const reg = getAgentRegistry(cwd);
              if (!error) reg.complete(agentId, { questionCount: Array.isArray(questions) ? questions.length : 0 });
              else reg.fail(agentId, 1, error);
            } catch (_) {
            }
          }
          try {
            fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase: error ? "error" : "done", agent: "Onboard", desc: error ? `Onboard questions failed: ${error}` : `Onboard: ${Array.isArray(questions) ? questions.length : 0} questions` }) + "\n");
          } catch (_) {
          }
        }).catch((err) => {
          if (agentId) {
            try {
              getAgentRegistry(cwd).fail(agentId, 1, String(err));
            } catch (_) {
            }
          }
        });
        try {
          fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase: "start", agent: "Onboard", desc: "Generating clarification questions" }) + "\n");
        } catch (_) {
        }
        sendJson(res, 202, { ok: true });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    async function handleOnboardAnswer(req, res, cwd) {
      try {
        if (!onboardSession) {
          sendJson(res, 400, { error: "No onboarding session active" });
          return;
        }
        const body = await readJsonBody(req);
        const answers = body.answers || [];
        onboardSession.answers = answers;
        onboardSession.phase = "proposals";
        persistOnboardSession(cwd);
        const { runAI } = require_ai_runner();
        const activityFile = path.join(cwd, ".planning", "activity.jsonl");
        let answersBlock = "";
        if (answers.length > 0) {
          answersBlock = "\n\nThe user answered these clarification questions:\n" + answers.map((a) => `Q: ${a.question}
A: ${a.answer}`).join("\n\n");
        }
        const prompt = `You are helping a user break down their software project vision into concrete declarations.

The user's vision: "${onboardSession.prompt}"${answersBlock}

In the Declare framework, a "declaration" is a statement about what WILL be true when the project succeeds. Each declaration should be:
- A concrete, verifiable outcome (not a task or feature)
- Scoped to be achievable independently
- Written as a present-tense statement of truth (e.g., "Users can sign in with Google OAuth")

Propose 4-6 declarations that together cover the user's vision. Each should be distinct and non-overlapping.

Output ONLY a JSON array:
[{"title": "Short declaration title", "statement": "The full declaration statement written as a present-tense truth", "reasoning": "Brief explanation of why this declaration matters"}]`;
        let agentId;
        try {
          const reg = getAgentRegistry(cwd);
          const agent = reg.spawn("onboard-propose", "project", "");
          agentId = agent.id;
        } catch (_) {
        }
        const abortController = new AbortController();
        onboardSession.abortController = abortController;
        if (agentId) onboardSession.agentId = agentId;
        runAI(prompt, {
          cwd,
          model: "sonnet",
          maxTurns: 1,
          abortController,
          onText: (text) => {
            const payload = `event: onboard-output
data: ${JSON.stringify({ text })}

`;
            for (const client of sseClients) {
              try {
                client.write(payload);
              } catch (_) {
                sseClients.delete(client);
              }
            }
          }
        }).then(({ text, error }) => {
          let proposals = null;
          if (!error && text) {
            try {
              proposals = JSON.parse(text.trim());
            } catch (_) {
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                try {
                  proposals = JSON.parse(jsonMatch[0]);
                } catch (_2) {
                }
              }
            }
          }
          if (onboardSession && proposals) {
            onboardSession.proposals = proposals;
            persistOnboardSession(cwd);
          }
          const payload = `event: onboard-proposals-complete
data: ${JSON.stringify({ proposals, error })}

`;
          for (const client of sseClients) {
            try {
              client.write(payload);
            } catch (_) {
              sseClients.delete(client);
            }
          }
          if (agentId) {
            try {
              const reg = getAgentRegistry(cwd);
              if (!error) reg.complete(agentId, { proposalCount: Array.isArray(proposals) ? proposals.length : 0 });
              else reg.fail(agentId, 1, error);
            } catch (_) {
            }
          }
          try {
            fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase: error ? "error" : "done", agent: "Onboard", desc: error ? `Onboard proposals failed: ${error}` : `Onboard: ${Array.isArray(proposals) ? proposals.length : 0} proposals` }) + "\n");
          } catch (_) {
          }
        }).catch((err) => {
          if (agentId) {
            try {
              getAgentRegistry(cwd).fail(agentId, 1, String(err));
            } catch (_) {
            }
          }
        });
        try {
          fs.appendFileSync(activityFile, JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Task", phase: "start", agent: "Onboard", desc: "Generating declaration proposals" }) + "\n");
        } catch (_) {
        }
        sendJson(res, 202, { ok: true });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    async function handleOnboardApprove(req, res, cwd) {
      try {
        const body = await readJsonBody(req);
        const { title, statement } = body;
        if (!title || !statement) {
          sendJson(res, 400, { error: "Missing title or statement" });
          return;
        }
        const result = runAddDeclaration2(cwd, ["--title", title, "--statement", statement]);
        if ("error" in result) {
          sendJson(res, 400, { error: result.error });
          return;
        }
        setReviewState(cwd, result.id, "approved");
        broadcastChange();
        if (onboardSession) {
          onboardSession.phase = "approving";
          onboardSession.approveIndex = (onboardSession.approveIndex || 0) + 1;
          persistOnboardSession(cwd);
        }
        try {
          const graph = runLoadGraph2(cwd);
          if (!("error" in graph)) {
            const declarations = graph.declarations.map((d) => ({
              id: d.id,
              statement: d.statement,
              milestones: d.milestones || []
            }));
            const dr = getDerivationRunner(cwd);
            dr.derive(result.id, declarations);
          }
        } catch (_) {
        }
        sendJson(res, 201, result);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleOnboardCancel(req, res, cwd) {
      if (onboardSession && onboardSession.abortController) {
        onboardSession.abortController.abort();
      }
      onboardSession = null;
      persistOnboardSession(cwd);
      sendJson(res, 200, { ok: true });
    }
    function handleArchiveNode(res, cwd, nodeId) {
      const id = nodeId.toUpperCase();
      const prefix = id.split("-")[0];
      const planningDir = path.join(cwd, ".planning");
      try {
        if (prefix === "D") {
          const futurePath = path.join(planningDir, "FUTURE.md");
          const content = fs.readFileSync(futurePath, "utf-8");
          const declarations = parseFutureFile(content);
          const decl = declarations.find((d) => d.id === id);
          if (decl) {
            decl.status = "DONE";
            decl.reviewState = "approved";
            const projectNameMatch = content.match(/^# Future:\s*(.+)/m);
            const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Project";
            fs.writeFileSync(futurePath, writeFutureFile(declarations, projectName), "utf-8");
          }
        } else if (prefix === "M") {
          const msPath = path.join(planningDir, "MILESTONES.md");
          const content = fs.readFileSync(msPath, "utf-8");
          const { milestones } = parseMilestonesFile(content);
          const mile = milestones.find((m) => m.id === id);
          if (mile) {
            mile.status = "DONE";
            mile.reviewState = "approved";
            const projectNameMatch = content.match(/^# Milestones:\s*(.+)/m);
            const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Project";
            fs.writeFileSync(msPath, writeMilestonesFile(milestones, projectName), "utf-8");
          }
        } else if (prefix === "A") {
          const graph = runLoadGraph2(cwd);
          if (!("error" in graph)) {
            const action = graph.actions.find((a) => a.id.toUpperCase() === id);
            if (action) {
              for (const mId of action.causes || []) {
                const folder = findMilestoneFolder(planningDir, mId);
                if (folder) {
                  const planPath = path.join(folder, "PLAN.md");
                  if (fs.existsSync(planPath)) {
                    const content = fs.readFileSync(planPath, "utf-8");
                    const updated = updateActionStatus(content, id, "DONE");
                    fs.writeFileSync(planPath, updated, "utf-8");
                  }
                }
              }
            }
          }
        }
        const activityFile = path.join(planningDir, "activity.jsonl");
        const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Review", phase: "end", desc: `Archived ${id}`, nodeId: id };
        fs.appendFileSync(activityFile, JSON.stringify(entry) + "\n");
        const payload = `event: change
data: ${JSON.stringify({ reason: "archive", nodeId: id })}

`;
        for (const client of sseClients) {
          try {
            client.write(payload);
          } catch (_) {
            sseClients.delete(client);
          }
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function handleDeleteNode(res, cwd, nodeId) {
      const id = nodeId.toUpperCase();
      const prefix = id.split("-")[0];
      const planningDir = path.join(cwd, ".planning");
      try {
        if (prefix === "D") {
          const futurePath = path.join(planningDir, "FUTURE.md");
          const content = fs.readFileSync(futurePath, "utf-8");
          const declarations = parseFutureFile(content);
          const filtered = declarations.filter((d) => d.id !== id);
          if (filtered.length === declarations.length) {
            sendJson(res, 404, { error: "Declaration not found: " + id });
            return;
          }
          const projectNameMatch = content.match(/^# Future:\s*(.+)/m);
          const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Project";
          fs.writeFileSync(futurePath, writeFutureFile(filtered, projectName), "utf-8");
        } else if (prefix === "M") {
          const msPath = path.join(planningDir, "MILESTONES.md");
          const content = fs.readFileSync(msPath, "utf-8");
          const { milestones } = parseMilestonesFile(content);
          const filtered = milestones.filter((m) => m.id !== id);
          if (filtered.length === milestones.length) {
            sendJson(res, 404, { error: "Milestone not found: " + id });
            return;
          }
          const projectNameMatch = content.match(/^# Milestones:\s*(.+)/m);
          const projectName = projectNameMatch ? projectNameMatch[1].trim() : "Project";
          fs.writeFileSync(msPath, writeMilestonesFile(filtered, projectName), "utf-8");
        } else if (prefix === "A") {
          const graph = runLoadGraph2(cwd);
          if (!("error" in graph)) {
            const action = graph.actions.find((a) => a.id.toUpperCase() === id);
            if (action) {
              for (const mId of action.causes || []) {
                const folder = findMilestoneFolder(planningDir, mId);
                if (folder) {
                  const planPath = path.join(folder, "PLAN.md");
                  if (fs.existsSync(planPath)) {
                    let content = fs.readFileSync(planPath, "utf-8");
                    const regex = new RegExp(`### ${id}:[\\s\\S]*?(?=### |$)`, "i");
                    content = content.replace(regex, "");
                    fs.writeFileSync(planPath, content, "utf-8");
                  }
                }
              }
            }
          }
        }
        const activityFile = path.join(planningDir, "activity.jsonl");
        const entry = { ts: (/* @__PURE__ */ new Date()).toISOString(), tool: "Review", phase: "end", desc: `Deleted ${id}`, nodeId: id };
        fs.appendFileSync(activityFile, JSON.stringify(entry) + "\n");
        const payload2 = `event: change
data: ${JSON.stringify({ reason: "delete", nodeId: id })}

`;
        for (const client of sseClients) {
          try {
            client.write(payload2);
          } catch (_) {
            sseClients.delete(client);
          }
        }
        sendJson(res, 200, { ok: true });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
    }
    function route(req, res, cwd) {
      const method = req.method || "GET";
      const url = req.url || "/";
      const urlPath = url.split("?")[0];
      if (method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return;
      }
      if (method !== "GET" && method !== "POST" && method !== "PUT" && method !== "DELETE") {
        sendJson(res, 405, { error: "Method Not Allowed" });
        return;
      }
      if (method === "POST" && urlPath === "/api/declarations") {
        readJsonBody(req).then((body) => {
          if (!body.title || !body.statement) {
            sendJson(res, 400, { error: "Missing required fields: title and statement" });
            return;
          }
          const result = runAddDeclaration2(cwd, ["--title", body.title, "--statement", body.statement]);
          if ("error" in result) {
            sendJson(res, 400, result);
            return;
          }
          sendJson(res, 201, result);
          broadcastChange();
        }).catch((err) => sendJson(res, 400, { error: String(err) }));
        return;
      }
      const declRefPutMatch = method === "PUT" && urlPath.match(/^\/api\/declarations\/([^/]+)\/ref$/);
      if (declRefPutMatch) {
        readJsonBody(req).then((body) => {
          const declId = declRefPutMatch[1].toUpperCase();
          const planningDir = path.join(cwd, ".planning");
          const futurePath = path.join(planningDir, "FUTURE.md");
          if (!fs.existsSync(futurePath)) {
            sendJson(res, 404, { error: "FUTURE.md not found" });
            return;
          }
          const futureContent = fs.readFileSync(futurePath, "utf-8");
          const declarations = parseFutureFile(futureContent);
          const decl = declarations.find((d) => d.id === declId);
          if (!decl) {
            sendJson(res, 404, { error: `Declaration not found: ${declId}` });
            return;
          }
          const ref = {};
          if (body.url != null) ref.url = body.url || void 0;
          if (body.path != null) ref.path = body.path || void 0;
          decl.ref = ref.url || ref.path ? ref : void 0;
          const headerMatch = futureContent.match(/^# Future: (.+)/m);
          const projectName = headerMatch ? headerMatch[1].trim() : "Project";
          const content = writeFutureFile(declarations, projectName);
          fs.writeFileSync(futurePath, content, "utf-8");
          sendJson(res, 200, { id: declId, ref: decl.ref || null });
          broadcastChange();
        }).catch((err) => sendJson(res, 400, { error: String(err) }));
        return;
      }
      const getAnnotationsMatch = method === "GET" && urlPath.match(/^\/api\/node\/([^/]+)\/annotations$/);
      if (getAnnotationsMatch) {
        handleGetAnnotations(res, cwd, getAnnotationsMatch[1]);
        return;
      }
      const getRevisionsMatch = method === "GET" && urlPath.match(/^\/api\/node\/([^/]+)\/revisions$/);
      if (getRevisionsMatch) {
        handleGetRevisions(res, cwd, getRevisionsMatch[1]);
        return;
      }
      const incrementRoundMatch = method === "POST" && urlPath.match(/^\/api\/node\/([^/]+)\/annotations\/increment-round$/);
      if (incrementRoundMatch) {
        handleIncrementRevisionRound(res, cwd, incrementRoundMatch[1]);
        return;
      }
      const postAnnotationsMatch = method === "POST" && urlPath.match(/^\/api\/node\/([^/]+)\/annotations$/);
      if (postAnnotationsMatch) {
        handleAddAnnotation(req, res, cwd, postAnnotationsMatch[1]);
        return;
      }
      const deleteAnnotationMatch = method === "DELETE" && urlPath.match(/^\/api\/node\/([^/]+)\/annotations\/([^/]+)$/);
      if (deleteAnnotationMatch) {
        handleDeleteAnnotation(res, cwd, deleteAnnotationMatch[1], deleteAnnotationMatch[2]);
        return;
      }
      const reviewStateMatch = method === "PUT" && urlPath.match(/^\/api\/node\/([^/]+)\/review-state$/);
      if (reviewStateMatch) {
        handleUpdateReviewState(req, res, cwd, reviewStateMatch[1]);
        return;
      }
      const declPutMatch = method === "PUT" && urlPath.match(/^\/api\/declarations\/([^/]+)$/);
      if (declPutMatch) {
        readJsonBody(req).then((body) => {
          const args = ["--id", declPutMatch[1]];
          if (body.title) {
            args.push("--title", body.title);
          }
          if (body.statement) {
            args.push("--statement", body.statement);
          }
          if (body.status) {
            args.push("--status", body.status);
          }
          if (!body.title && !body.statement && !body.status) {
            sendJson(res, 400, { error: "At least one of title, statement, or status must be provided" });
            return;
          }
          const result = runUpdateDeclaration2(cwd, args);
          if ("error" in result) {
            const status = result.error.includes("not found") ? 404 : 400;
            sendJson(res, status, result);
            return;
          }
          sendJson(res, 200, result);
          broadcastChange();
        }).catch((err) => sendJson(res, 400, { error: String(err) }));
        return;
      }
      const classifyMatch = method === "PUT" && urlPath.match(/^\/api\/milestones\/([^/]+)\/classify$/);
      if (classifyMatch) {
        readJsonBody(req).then((body) => {
          const milestoneId = classifyMatch[1].toUpperCase();
          const newClassification = body.classification === "human" ? "human" : "agent";
          try {
            const milestonesPath = path.join(cwd, ".planning", "MILESTONES.md");
            if (!fs.existsSync(milestonesPath)) {
              sendJson(res, 404, { error: "MILESTONES.md not found" });
              return;
            }
            const { parseMilestonesFile: parseMF, writeMilestonesFile: writeMF } = require_milestones();
            const content = fs.readFileSync(milestonesPath, "utf-8");
            const { milestones: allM } = parseMF(content);
            const target = allM.find((m) => m.id.toUpperCase() === milestoneId);
            if (!target) {
              sendJson(res, 404, { error: `Milestone '${milestoneId}' not found` });
              return;
            }
            target.classification = newClassification;
            const nameMatch = content.match(/^# Milestones:\s*(.+)/m);
            const pName = nameMatch ? nameMatch[1].trim() : "Project";
            fs.writeFileSync(milestonesPath, writeMF(allM, pName));
            sendJson(res, 200, { ok: true, id: target.id, classification: newClassification });
            broadcastChange();
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
        }).catch((err) => sendJson(res, 400, { error: String(err) }));
        return;
      }
      const depsMatch = method === "PUT" && urlPath.match(/^\/api\/milestones\/([^/]+)\/depends-on$/);
      if (depsMatch) {
        readJsonBody(req).then((body) => {
          const milestoneId = depsMatch[1].toUpperCase();
          const deps = Array.isArray(body.dependsOn) ? body.dependsOn.map((d) => d.toUpperCase()) : [];
          try {
            const milestonesPath = path.join(cwd, ".planning", "MILESTONES.md");
            if (!fs.existsSync(milestonesPath)) {
              sendJson(res, 404, { error: "MILESTONES.md not found" });
              return;
            }
            const { parseMilestonesFile: parseMF, writeMilestonesFile: writeMF } = require_milestones();
            const content = fs.readFileSync(milestonesPath, "utf-8");
            const { milestones: allM } = parseMF(content);
            const target = allM.find((m) => m.id.toUpperCase() === milestoneId);
            if (!target) {
              sendJson(res, 404, { error: `Milestone '${milestoneId}' not found` });
              return;
            }
            for (const depId of deps) {
              if (!allM.find((m) => m.id.toUpperCase() === depId)) {
                sendJson(res, 400, { error: `Dependency '${depId}' not found` });
                return;
              }
            }
            if (deps.includes(milestoneId)) {
              sendJson(res, 400, { error: "Cannot depend on self" });
              return;
            }
            target.dependsOn = deps;
            const nameMatch = content.match(/^# Milestones:\s*(.+)/m);
            const pName = nameMatch ? nameMatch[1].trim() : "Project";
            fs.writeFileSync(milestonesPath, writeMF(allM, pName));
            sendJson(res, 200, { ok: true, id: target.id, dependsOn: deps });
            broadcastChange();
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
        }).catch((err) => sendJson(res, 400, { error: String(err) }));
        return;
      }
      const declDeleteMatch = method === "DELETE" && urlPath.match(/^\/api\/declarations\/([^/]+)$/);
      if (declDeleteMatch) {
        const result = runDeleteDeclaration2(cwd, ["--id", declDeleteMatch[1]]);
        if ("error" in result) {
          const status = result.error.includes("not found") ? 404 : 400;
          sendJson(res, status, result);
          return;
        }
        sendJson(res, 200, result);
        broadcastChange();
        return;
      }
      const nodeDeleteMatch = method === "DELETE" && urlPath.match(/^\/api\/node\/([^/]+)$/);
      if (nodeDeleteMatch) {
        handleDeleteNode(res, cwd, nodeDeleteMatch[1]);
        return;
      }
      if (method === "POST") {
        const executeMatch = urlPath.match(/^\/api\/action\/([^/]+)\/execute$/);
        if (executeMatch) {
          handleExecuteAction(res, cwd, executeMatch[1]);
          return;
        }
        const stopMatch = urlPath.match(/^\/api\/action\/([^/]+)\/stop$/);
        if (stopMatch) {
          const pm = getProcessManager(cwd);
          const result = pm.stop(stopMatch[1]);
          if (result.error) {
            sendJson(res, result.status || 500, { error: result.error });
          } else {
            sendJson(res, 200, { ok: true });
          }
          return;
        }
        if (urlPath === "/api/milestones/derive") {
          handleDerive(req, res, cwd);
          return;
        }
        if (urlPath === "/api/milestones/derive/stop") {
          handleDeriveStop(req, res, cwd);
          return;
        }
        if (urlPath === "/api/milestones/derive/accept") {
          handleDeriveAccept(req, res, cwd);
          return;
        }
        if (urlPath === "/api/declarations/derive-all") {
          handleDeriveAll(res, cwd);
          return;
        }
        const actionDeriveMatch = urlPath.match(/^\/api\/milestones\/([^/]+)\/actions\/derive$/);
        if (actionDeriveMatch) {
          handleActionDerive(res, cwd, actionDeriveMatch[1]);
          return;
        }
        const actionDeriveStopMatch = urlPath.match(/^\/api\/milestones\/([^/]+)\/actions\/derive\/stop$/);
        if (actionDeriveStopMatch) {
          handleActionDeriveStop(res, cwd);
          return;
        }
        const actionDeriveAcceptMatch = urlPath.match(/^\/api\/milestones\/([^/]+)\/actions\/derive\/accept$/);
        if (actionDeriveAcceptMatch) {
          handleActionDeriveAccept(req, res, cwd, actionDeriveAcceptMatch[1]);
          return;
        }
        if (urlPath === "/api/play") {
          const manifestPath = path.join(cwd, ".planning", "execution-manifest.json");
          const hasManifest = fs.existsSync(manifestPath);
          if (hasManifest) {
            const graph = runLoadGraph2(cwd);
            if ("error" in graph) {
              sendJson(res, 500, { error: graph.error });
              return;
            }
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            const actionIds = /* @__PURE__ */ new Set();
            for (const wave of manifest.waves || []) {
              for (const m of wave.milestones || []) {
                for (const aid of m.actions || []) actionIds.add(aid.toUpperCase());
              }
            }
            const unapproved = (graph.actions || []).filter((a) => actionIds.has(a.id.toUpperCase()) && a.reviewState !== "approved");
            if (unapproved.length > 0) {
              sendJson(res, 403, {
                error: "Cannot play: unapproved actions exist",
                unapproved: unapproved.map((a) => ({ id: a.id, title: a.title, reviewState: a.reviewState || "draft" }))
              });
              return;
            }
            const plr = getPipelineRunner(cwd);
            const result = plr.start();
            if (result.error) {
              sendJson(res, 409, { error: result.error });
            } else {
              sendJson(res, 202, { ok: true, waves: result.waves });
            }
          } else {
            const pr = getPlayRunner(cwd);
            const result = pr.start();
            if (result.error) {
              const status = result.unapproved ? 403 : 409;
              sendJson(res, status, { error: result.error, ...result.unapproved && { unapproved: result.unapproved } });
            } else {
              sendJson(res, 202, { ok: true, waves: result.waves });
            }
          }
          return;
        }
        if (urlPath === "/api/play/stop") {
          const pr = getPlayRunner(cwd);
          const result = pr.stop();
          const plr = getPipelineRunner(cwd);
          if (plr.running()) plr.stop();
          if (result.error && !plr.running()) {
            sendJson(res, 400, { error: result.error });
          } else {
            sendJson(res, 200, { ok: true });
          }
          return;
        }
        if (urlPath === "/api/pipeline/skip-action") {
          const plr = getPipelineRunner(cwd);
          const result = plr.skip();
          if (result.error) {
            sendJson(res, 400, { error: result.error });
          } else {
            sendJson(res, 200, { ok: true });
          }
          return;
        }
        const reviseMatch = urlPath.match(/^\/api\/node\/([^/]+)\/revise$/);
        if (reviseMatch) {
          handleRevise(req, res, cwd, reviseMatch[1]);
          return;
        }
        if (urlPath === "/api/revise/stop") {
          handleReviseStop(res, cwd);
          return;
        }
        const archiveMatch = urlPath.match(/^\/api\/node\/([^/]+)\/archive$/);
        if (archiveMatch) {
          handleArchiveNode(res, cwd, archiveMatch[1]);
          return;
        }
        const refineMatch = urlPath.match(/^\/api\/node\/([^/]+)\/refine$/);
        if (refineMatch) {
          handleRefine(req, res, cwd, refineMatch[1]);
          return;
        }
        if (urlPath === "/api/refine/stop") {
          handleRefineStop(res);
          return;
        }
        if (urlPath === "/api/refine/accept") {
          handleRefineAccept(req, res, cwd);
          return;
        }
        const discussMatch = urlPath.match(/^\/api\/node\/([^/]+)\/discuss$/);
        if (discussMatch) {
          handleDiscuss(req, res, cwd, discussMatch[1]);
          return;
        }
        const discussAnswerMatch = urlPath.match(/^\/api\/node\/([^/]+)\/discuss\/answer$/);
        if (discussAnswerMatch) {
          handleDiscussAnswer(req, res, cwd, discussAnswerMatch[1]);
          return;
        }
        if (urlPath === "/api/command") {
          handleCommand(req, res, cwd);
          return;
        }
        if (urlPath === "/api/onboard/complete") {
          onboardSession = null;
          persistOnboardSession(cwd);
          sendJson(res, 200, { ok: true });
          return;
        }
        if (urlPath === "/api/onboard") {
          handleOnboard(req, res, cwd);
          return;
        }
        if (urlPath === "/api/onboard/answer") {
          handleOnboardAnswer(req, res, cwd);
          return;
        }
        if (urlPath === "/api/onboard/approve") {
          handleOnboardApprove(req, res, cwd);
          return;
        }
        if (urlPath === "/api/onboard/cancel") {
          handleOnboardCancel(req, res, cwd);
          return;
        }
        if (urlPath === "/api/execution-manifest") {
          handleSaveManifest(req, res, cwd);
          return;
        }
        sendJson(res, 404, { error: `Route not found: ${urlPath}` });
        return;
      }
      if (urlPath === "/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*"
        });
        res.write("retry: 3000\n\n");
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
        return;
      }
      if (urlPath === "/api/graph") {
        handleGraph(res, cwd);
        return;
      }
      if (urlPath === "/api/status") {
        handleStatus(res, cwd);
        return;
      }
      if (urlPath === "/api/project") {
        try {
          const projectPath = path.join(cwd, ".planning", "PROJECT.md");
          const content = fs.existsSync(projectPath) ? fs.readFileSync(projectPath, "utf-8") : "";
          const titleMatch = content.match(/^#\s+(.+)/m);
          const title = titleMatch ? titleMatch[1].trim() : path.basename(cwd);
          const whatMatch = content.match(/## What This Is\s*\n([\s\S]*?)(?=\n##|\n$|$)/);
          const description = whatMatch ? whatMatch[1].trim() : "";
          const coreMatch = content.match(/## Core Value\s*\n([\s\S]*?)(?=\n##|\n$|$)/);
          const coreValue = coreMatch ? coreMatch[1].trim() : "";
          const stateMatch = content.match(/## Current State\s*\n([\s\S]*?)(?=\n##|\n---|$)/);
          let currentState = "";
          if (stateMatch) {
            const lines = stateMatch[1].trim().split("\n").filter((l) => l.trim());
            currentState = lines.slice(0, 3).map((l) => l.replace(/^\*\*/, "").replace(/\*\*/, "")).join(" | ");
          }
          sendJson(res, 200, { title, description, coreValue, currentState, folder: path.basename(cwd) });
        } catch (err) {
          sendJson(res, 500, { error: String(err) });
        }
        return;
      }
      const workabilityMatch = urlPath.match(/^\/api\/workability\/([^/]+)$/);
      if (workabilityMatch) {
        handleWorkability(res, cwd, workabilityMatch[1]);
        return;
      }
      const milestoneLogMatch = urlPath.match(/^\/api\/milestone\/([^/]+)\/log$/);
      if (milestoneLogMatch) {
        handleMilestoneLog(res, cwd, milestoneLogMatch[1]);
        return;
      }
      const milestoneMatch = urlPath.match(/^\/api\/milestone\/([^/]+)$/);
      if (milestoneMatch) {
        handleMilestone(res, cwd, milestoneMatch[1]);
        return;
      }
      if (urlPath === "/api/running") {
        const pm = getProcessManager(cwd);
        sendJson(res, 200, { running: pm.running() });
        return;
      }
      if (urlPath === "/api/agents") {
        const reg = getAgentRegistry(cwd);
        sendJson(res, 200, reg.getAll());
        return;
      }
      const agentMatch = urlPath.match(/^\/api\/agents\/([^/]+)$/);
      if (agentMatch) {
        const reg = getAgentRegistry(cwd);
        const agent = reg.get(decodeURIComponent(agentMatch[1]));
        if (agent) {
          sendJson(res, 200, agent);
        } else {
          sendJson(res, 404, { error: "Agent not found" });
        }
        return;
      }
      if (urlPath === "/api/play/status") {
        const pr = getPlayRunner(cwd);
        const plr = getPipelineRunner(cwd);
        sendJson(res, 200, { running: pr.running() || plr.running(), paused: plr.paused(), status: pr.status() || plr.status() });
        return;
      }
      if (urlPath === "/api/pipeline/state") {
        const plr = getPipelineRunner(cwd);
        const state = plr.getFullState();
        if (state) {
          sendJson(res, 200, { active: true, ...state });
        } else {
          sendJson(res, 200, { active: false });
        }
        return;
      }
      if (urlPath === "/api/derivation/running") {
        const dr = getDerivationRunner(cwd);
        const runningSessions = dr.running();
        sendJson(res, 200, {
          running: runningSessions ? runningSessions[0].sessionId : null,
          sessions: runningSessions
        });
        return;
      }
      if (urlPath === "/api/onboard/state") {
        if (!onboardSession) restoreOnboardSession(cwd);
        if (onboardSession) {
          sendJson(res, 200, {
            active: true,
            prompt: onboardSession.prompt,
            phase: onboardSession.phase,
            questions: onboardSession.questions,
            proposals: onboardSession.proposals,
            answers: onboardSession.answers,
            approveIndex: onboardSession.approveIndex || 0
          });
        } else {
          sendJson(res, 200, { active: false });
        }
        return;
      }
      const actionDeriveRunningMatch = urlPath.match(/^\/api\/milestones\/([^/]+)\/actions\/derive\/running$/);
      if (actionDeriveRunningMatch) {
        const adr = getActionDerivationRunner(cwd);
        sendJson(res, 200, { running: adr.running() });
        return;
      }
      if (urlPath === "/api/lifecycle") {
        handleLifecycle(res, cwd);
        return;
      }
      if (urlPath === "/api/workflow/state") {
        handleWorkflowState(res, cwd);
        return;
      }
      if (urlPath === "/api/activity") {
        handleActivity(res, cwd);
        return;
      }
      if (urlPath === "/api/readiness") {
        handleReadiness(res, cwd);
        return;
      }
      if (urlPath === "/api/execution-manifest") {
        handleGetManifest(res, cwd);
        return;
      }
      if (urlPath === "/api/files") {
        handleFileContent(req, res, cwd);
        return;
      }
      const actionMatch = urlPath.match(/^\/api\/action\/([^/]+)$/);
      if (actionMatch) {
        const result = runGetExecPlan2(cwd, ["--action", actionMatch[1]]);
        sendJson(res, result.error ? 404 : 200, result);
        return;
      }
      const publicDir = getPublicDir(cwd);
      if (urlPath === "/") {
        const indexPath = path.join(publicDir, "index.html");
        sendFile(res, indexPath);
        return;
      }
      if (urlPath.startsWith("/public/")) {
        const relative = urlPath.replace(/^\/public\//, "");
        const resolved = path.resolve(publicDir, relative);
        if (!resolved.startsWith(publicDir + path.sep) && resolved !== publicDir) {
          sendJson(res, 403, { error: "Forbidden" });
          return;
        }
        sendFile(res, resolved);
        return;
      }
      sendJson(res, 404, { error: `Route not found: ${urlPath}` });
    }
    function createServer(cwd, port) {
      const server = http.createServer((req, res) => {
        route(req, res, cwd);
      });
      return server;
    }
    function findFreePort(startPort) {
      return new Promise((resolve) => {
        const probe = net.createServer();
        probe.listen(startPort, "127.0.0.1", () => {
          const { port } = (
            /** @type {import('net').AddressInfo} */
            probe.address()
          );
          probe.close(() => resolve(port));
        });
        probe.on("error", () => resolve(findFreePort(startPort + 1)));
      });
    }
    async function startServer(cwd, port) {
      const preferredPort = port || parseInt(process.env.PORT || "", 10) || 0;
      const listenPort = preferredPort === 0 ? 0 : await findFreePort(preferredPort);
      const server = createServer(cwd, listenPort);
      const resolvedPort = await new Promise((resolve) => {
        server.listen(listenPort, "127.0.0.1", () => {
          const assigned = (
            /** @type {import('net').AddressInfo} */
            server.address().port
          );
          watchPlanning(cwd);
          resolve(assigned);
        });
      });
      const portFilePath = require("path").join(cwd, ".planning", "server.port");
      require("fs").writeFileSync(portFilePath, String(resolvedPort), "utf-8");
      const deletePortFile = () => {
        try {
          require("fs").unlinkSync(portFilePath);
        } catch (_) {
        }
      };
      server.on("close", deletePortFile);
      process.on("exit", deletePortFile);
      const reg = getAgentRegistry(cwd);
      const restored = reg.restoreFromDisk();
      if (restored.interrupted > 0) {
        process.stderr.write(`[declare] Restored agent state: ${restored.interrupted} agent(s) marked as interrupted from previous run
`);
      }
      const url = `http://localhost:${resolvedPort}`;
      return { server, port: resolvedPort, url };
    }
    module2.exports = { createServer, startServer };
  }
});

// src/commands/serve.js
var require_serve = __commonJS({
  "src/commands/serve.js"(exports2, module2) {
    "use strict";
    var { startServer } = require_server();
    function parsePortFlag(args) {
      const idx = args.indexOf("--port");
      if (idx === -1 || idx + 1 >= args.length) return void 0;
      const value = parseInt(args[idx + 1], 10);
      return Number.isNaN(value) ? void 0 : value;
    }
    async function runServe2(cwd, args) {
      const port = parsePortFlag(args);
      const { server, port: resolvedPort, url } = await startServer(cwd, port);
      process.on("SIGINT", () => {
        server.close(() => process.exit(0));
      });
      process.on("SIGTERM", () => {
        server.close(() => process.exit(0));
      });
      return { url, port: resolvedPort, pid: process.pid };
    }
    module2.exports = { runServe: runServe2 };
  }
});

// src/commands/open.js
var require_open = __commonJS({
  "src/commands/open.js"(exports2, module2) {
    "use strict";
    var fs = require("fs");
    var path = require("path");
    var http = require("http");
    var { spawn } = require("child_process");
    var { runInit: runInit2 } = require_init();
    function checkServer(port) {
      return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/api/graph`, (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 300);
          res.resume();
        });
        req.on("error", () => resolve(false));
        req.setTimeout(2e3, () => {
          req.destroy();
          resolve(false);
        });
      });
    }
    async function waitForPortFile(portFile, maxAttempts = 30, intervalMs = 200) {
      for (let i = 0; i < maxAttempts; i++) {
        try {
          const content = fs.readFileSync(portFile, "utf8").trim();
          const port = parseInt(content, 10);
          if (!isNaN(port) && port > 0) return port;
        } catch (_) {
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return null;
    }
    async function runOpen2(cwd, args) {
      const planningDir = path.join(cwd, ".planning");
      if (!fs.existsSync(planningDir)) {
        console.log("Initializing Declare project in: " + cwd);
        const result = runInit2(cwd, []);
        if (result.created && result.created.length > 0) {
          console.log("Created: " + result.created.join(", "));
        }
      }
      const portFile = path.join(cwd, ".planning", "server.port");
      if (fs.existsSync(portFile)) {
        const existingPort = parseInt(fs.readFileSync(portFile, "utf8").trim(), 10);
        if (!isNaN(existingPort) && existingPort > 0) {
          const isRunning = await checkServer(existingPort);
          if (isRunning) {
            console.log(`Dashboard: http://localhost:${existingPort}`);
            return;
          }
          try {
            fs.unlinkSync(portFile);
          } catch (_) {
          }
        }
      }
      const bundlePath = path.resolve(__dirname, "declare-tools.cjs");
      const child = spawn(process.execPath, [bundlePath, "serve"], {
        cwd,
        detached: true,
        stdio: "ignore"
      });
      child.unref();
      const port = await waitForPortFile(portFile);
      if (!port) {
        console.error("[declare] Server failed to start (no port file after 6s)");
        process.exit(1);
      }
      console.log(`Dashboard: http://localhost:${port}`);
    }
    module2.exports = { runOpen: runOpen2 };
  }
});

// src/declare-tools.js
var { commitPlanningDocs } = require_commit();
var { readState, recordSession } = require_state();
var { runInit } = require_init();
var { runStatus } = require_status();
var { runHelp } = require_help();
var { runAddDeclaration } = require_add_declaration();
var { runUpdateDeclaration } = require_update_declaration();
var { runDeleteDeclaration } = require_delete_declaration();
var { runAddMilestone } = require_add_milestone();
var { runAddMilestonesBatch } = require_add_milestones_batch();
var { runAddAction } = require_add_action();
var { runCreatePlan } = require_create_plan();
var { runLoadGraph } = require_load_graph();
var { runTrace } = require_trace();
var { runPrioritize } = require_prioritize();
var { runVisualize } = require_visualize();
var { runComputeWaves } = require_compute_waves();
var { runGenerateExecPlan } = require_generate_exec_plan();
var { runVerifyWave } = require_verify_wave();
var { runExecute } = require_execute();
var { runVerifyMilestone } = require_verify_milestone();
var { runCheckDrift } = require_check_drift();
var { runCheckOccurrence } = require_check_occurrence();
var { runComputePerformance } = require_compute_performance();
var { runRenegotiate } = require_renegotiate();
var { runCompleteMilestone } = require_complete_milestone();
var { runSyncStatus } = require_sync_status();
var { runGetExecPlan } = require_get_exec_plan();
var { runQuickTask } = require_quick_task();
var { runAddTodo, runCheckTodos, runCompleteTodo } = require_todo();
var { runConfigGet } = require_config_get();
var { runConfigSet } = require_config_set();
var { runHealthCheck, runHealthCheckRepair } = require_health_check();
var { runServe } = require_serve();
var { runOpen } = require_open();
function parseCwdFlag(argv) {
  const idx = argv.indexOf("--cwd");
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}
function parsePositionalArgs(argv) {
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === "--cwd") {
      i += 2;
    } else if (argv[i] === "--files") {
      i++;
      while (i < argv.length && !argv[i].startsWith("--")) i++;
    } else if (argv[i].startsWith("--")) {
      i++;
    } else {
      positional.push(argv[i]);
      i++;
    }
  }
  return positional;
}
function parseFilesFlag(argv) {
  const idx = argv.indexOf("--files");
  if (idx === -1) return [];
  const files = [];
  for (let i = idx + 1; i < argv.length; i++) {
    if (argv[i].startsWith("--")) break;
    files.push(argv[i]);
  }
  return files;
}
function parseNamedFlag(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const sub = args[0];
  const isDefaultOpen = !sub || sub === "." || (sub.startsWith("/") || sub.startsWith("~"));
  if (isDefaultOpen) {
    let projectRoot = process.cwd();
    if (sub && sub !== ".") {
      projectRoot = sub.startsWith("~") ? sub.replace("~", require("os").homedir()) : sub;
    }
    runOpen(projectRoot, args.slice(1)).catch((err) => {
      console.error("[declare] " + err.message);
      process.exit(1);
    });
    return;
  }
  try {
    switch (command) {
      case "commit": {
        const message = args[1];
        if (!message) {
          console.log(JSON.stringify({ error: "commit requires a message argument" }));
          process.exit(1);
        }
        const files = parseFilesFlag(args);
        const cwd = process.cwd();
        const result = commitPlanningDocs(cwd, message, files);
        console.log(JSON.stringify(result));
        process.exit(result.committed || result.reason === "nothing_to_commit" ? 0 : 1);
        break;
      }
      case "init": {
        const cwdInit = parseCwdFlag(args) || process.cwd();
        const initArgs = parsePositionalArgs(args.slice(1));
        const result = runInit(cwdInit, initArgs);
        console.log(JSON.stringify(result));
        break;
      }
      case "status": {
        const cwdStatus = parseCwdFlag(args) || process.cwd();
        const result = runStatus(cwdStatus);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "help": {
        const result = runHelp();
        console.log(JSON.stringify(result));
        break;
      }
      case "add-declaration": {
        const cwdAddDecl = parseCwdFlag(args) || process.cwd();
        const result = runAddDeclaration(cwdAddDecl, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "update-declaration": {
        const cwdUpdateDecl = parseCwdFlag(args) || process.cwd();
        const result = runUpdateDeclaration(cwdUpdateDecl, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "delete-declaration": {
        const cwdDeleteDecl = parseCwdFlag(args) || process.cwd();
        const result = runDeleteDeclaration(cwdDeleteDecl, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "add-milestone": {
        const cwdAddMs = parseCwdFlag(args) || process.cwd();
        const result = runAddMilestone(cwdAddMs, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "add-milestones": {
        const cwdAddMsBatch = parseCwdFlag(args) || process.cwd();
        const result = runAddMilestonesBatch(cwdAddMsBatch, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "add-action": {
        const cwdAddAct = parseCwdFlag(args) || process.cwd();
        const result = runAddAction(cwdAddAct, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "create-plan": {
        const cwdCreatePlan = parseCwdFlag(args) || process.cwd();
        const result = runCreatePlan(cwdCreatePlan, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "load-graph": {
        const cwdLoadGraph = parseCwdFlag(args) || process.cwd();
        const result = runLoadGraph(cwdLoadGraph);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "trace": {
        const cwdTrace = parseCwdFlag(args) || process.cwd();
        const result = runTrace(cwdTrace, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "prioritize": {
        const cwdPrioritize = parseCwdFlag(args) || process.cwd();
        const result = runPrioritize(cwdPrioritize, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "visualize": {
        const cwdVisualize = parseCwdFlag(args) || process.cwd();
        const result = runVisualize(cwdVisualize, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "compute-waves": {
        const cwdComputeWaves = parseCwdFlag(args) || process.cwd();
        const result = runComputeWaves(cwdComputeWaves, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "generate-exec-plan": {
        const cwdGenExecPlan = parseCwdFlag(args) || process.cwd();
        const result = runGenerateExecPlan(cwdGenExecPlan, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "verify-wave": {
        const cwdVerifyWave = parseCwdFlag(args) || process.cwd();
        const result = runVerifyWave(cwdVerifyWave, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "sync-status": {
        const cwdSync = parseCwdFlag(args) || process.cwd();
        const result = runSyncStatus(cwdSync);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "get-exec-plan": {
        const cwdGep = parseCwdFlag(args) || process.cwd();
        const result = runGetExecPlan(cwdGep, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "execute": {
        const cwdExecute = parseCwdFlag(args) || process.cwd();
        const result = runExecute(cwdExecute, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "verify-milestone": {
        const cwdVerifyMs = parseCwdFlag(args) || process.cwd();
        const result = runVerifyMilestone(cwdVerifyMs, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "check-drift": {
        const cwdCheckDrift = parseCwdFlag(args) || process.cwd();
        const result = runCheckDrift(cwdCheckDrift);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "check-occurrence": {
        const cwdCheckOcc = parseCwdFlag(args) || process.cwd();
        const result = runCheckOccurrence(cwdCheckOcc, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "compute-performance": {
        const cwdCompPerf = parseCwdFlag(args) || process.cwd();
        const result = runComputePerformance(cwdCompPerf);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "renegotiate": {
        const cwdReneg = parseCwdFlag(args) || process.cwd();
        const result = runRenegotiate(cwdReneg, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "complete-milestone": {
        const cwdCompMs = parseCwdFlag(args) || process.cwd();
        const result = runCompleteMilestone(cwdCompMs, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "serve": {
        const cwdServe = parseCwdFlag(args) || process.cwd();
        runServe(cwdServe, args.slice(1)).then((result) => {
          console.log(JSON.stringify(result));
        }).catch((err) => {
          console.log(JSON.stringify({ error: err.message || String(err) }));
          process.exit(1);
        });
        break;
      }
      case "record-session": {
        const cwdRecordSession = parseCwdFlag(args) || process.cwd();
        const stoppedAt = parseNamedFlag(args, "--stopped-at");
        const resumeFile = parseNamedFlag(args, "--resume-file");
        if (!stoppedAt) {
          console.log(JSON.stringify({ error: "record-session requires --stopped-at argument" }));
          process.exit(1);
        }
        const result = recordSession(cwdRecordSession, stoppedAt, resumeFile || void 0);
        console.log(JSON.stringify(result));
        if (!result.ok) process.exit(1);
        break;
      }
      case "get-state": {
        const cwdGetState = parseCwdFlag(args) || process.cwd();
        const result = readState(cwdGetState);
        if (result === null) {
          console.log(JSON.stringify({ error: "STATE.md not found. Run /declare:new-project to initialize." }));
          process.exit(1);
        }
        console.log(JSON.stringify(result));
        break;
      }
      case "quick-task": {
        const cwdQuickTask = parseCwdFlag(args) || process.cwd();
        const result = runQuickTask(cwdQuickTask, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "add-todo": {
        const cwdAddTodo = parseCwdFlag(args) || process.cwd();
        const result = runAddTodo(cwdAddTodo, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "check-todos": {
        const cwdCheckTodos = parseCwdFlag(args) || process.cwd();
        const result = runCheckTodos(cwdCheckTodos);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "complete-todo": {
        const cwdCompleteTodo = parseCwdFlag(args) || process.cwd();
        const result = runCompleteTodo(cwdCompleteTodo, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "config-get": {
        const cwdConfigGet = parseCwdFlag(args) || process.cwd();
        const configGetArgs = parsePositionalArgs(args.slice(1));
        const result = runConfigGet(cwdConfigGet, configGetArgs);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "config-set": {
        const cwdConfigSet = parseCwdFlag(args) || process.cwd();
        const result = runConfigSet(cwdConfigSet, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "health-check": {
        const cwdHealthCheck = parseCwdFlag(args) || process.cwd();
        const repair = args.includes("--repair");
        const result = repair ? runHealthCheckRepair(cwdHealthCheck) : runHealthCheck(cwdHealthCheck);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}. Use: commit, init, status, add-declaration, update-declaration, delete-declaration, add-milestone, add-milestones, create-plan, load-graph, trace, prioritize, visualize, compute-waves, generate-exec-plan, verify-wave, verify-milestone, execute, check-drift, check-occurrence, compute-performance, renegotiate, complete-milestone, sync-status, serve, record-session, get-state, quick-task, add-todo, check-todos, complete-todo, config-get, config-set, health-check, help` }));
        process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }));
    process.exit(1);
  }
}
main();
