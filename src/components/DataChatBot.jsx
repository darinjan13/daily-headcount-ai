import { useState, useRef, useEffect, useMemo } from "react";

const WELCOME = "Hi! I have access to your full dataset and can answer precise questions — totals, rankings, breakdowns, anything. What would you like to know?";

const HOST = import.meta.env.VITE_API_URL || "https://daily-headcount-ai-backend.onrender.com";

const BRAND = {
  dark: "var(--color-text)",
  header: "var(--color-dark-serpent)",
  green: "var(--color-castleton-green)",
  saffron: "var(--color-saffron)",
  white: "var(--color-surface-elevated)",
  soft: "var(--color-surface-soft)",
  surface: "var(--color-surface)",
  border: "var(--color-border)",
  muted: "var(--color-text-light)",
};

// ── Lightweight markdown renderer ─────────────────────────────────────────────

function MarkdownMessage({ text }) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: "none", borderTop: "1px solid rgba(19,48,32,0.12)", margin: "8px 0" }} />);
      i++; continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)[1].length;
      const txt = line.replace(/^#{1,3}\s+/, "");
      const sizes = { 1: "15px", 2: "13px", 3: "12px" };
      elements.push(<div key={i} style={{ fontWeight: 800, fontSize: sizes[level], color: "var(--color-dark-serpent)", marginTop: 10, marginBottom: 4 }}>{renderInline(txt)}</div>);
      i++; continue;
    }
    if (line.trim().startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i]); i++; }
      const rows = tableLines.filter(l => !/^\s*\|[-| :]+\|\s*$/.test(l)).map(l => l.replace(/^\||\\|$/g, "").split("|").map(c => c.trim()));
      if (rows.length > 0) {
        elements.push(
          <div key={`table-${i}`} style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>
              <thead><tr>{rows[0].map((cell, ci) => <th key={ci} style={{ padding: "5px 10px", background: "rgba(4,98,65,0.1)", borderBottom: "2px solid rgba(4,98,65,0.2)", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{renderInline(cell)}</th>)}</tr></thead>
              <tbody>{rows.slice(1).map((row, ri) => <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(4,98,65,0.04)" }}>{row.map((cell, ci) => <td key={ci} style={{ padding: "5px 10px", borderBottom: "1px solid rgba(19,48,32,0.08)" }}>{renderInline(cell)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    if (/^\d+[.)]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) { listItems.push(lines[i].replace(/^\d+[.)]\s+/, "")); i++; }
      elements.push(<ol key={`ol-${i}`} style={{ margin: "6px 0", paddingLeft: "20px", listStyleType: "decimal" }}>{listItems.map((item, li) => <li key={li} style={{ marginBottom: "3px", fontSize: "13px", lineHeight: "1.5" }}>{renderInline(item)}</li>)}</ol>);
      continue;
    }
    if (/^[-•]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i])) { listItems.push(lines[i].replace(/^[-•]\s+/, "")); i++; }
      elements.push(<ul key={`ul-${i}`} style={{ margin: "6px 0", paddingLeft: "18px", listStyleType: "disc" }}>{listItems.map((item, li) => <li key={li} style={{ marginBottom: "3px", fontSize: "13px", lineHeight: "1.5" }}>{renderInline(item)}</li>)}</ul>);
      continue;
    }
    if (line.trim() === "") { elements.push(<div key={i} style={{ height: "6px" }} />); i++; continue; }
    elements.push(<p key={i} style={{ margin: "3px 0", fontSize: "13px", lineHeight: "1.6" }}>{renderInline(line)}</p>);
    i++;
  }
  return <div style={{ fontFamily: "inherit" }}>{elements}</div>;
}

function renderInline(text) {
  const parts = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0, match, key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2] !== undefined) parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    else if (match[3] !== undefined) parts.push(<em key={key++}>{match[3]}</em>);
    else if (match[4] !== undefined) parts.push(<code key={key++} style={{ background: "rgba(4,98,65,0.1)", borderRadius: "3px", padding: "1px 5px", fontSize: "12px", fontFamily: "monospace", color: "var(--color-dark-serpent)" }}>{match[4]}</code>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

// ── FilterTable ───────────────────────────────────────────────────────────────

function applyFilter(headers, rows, filterSpec) {
  const { columns, filters } = filterSpec;
  const colIndex = (name) => headers.indexOf(name);
  const filtered = rows.filter(row => filters.every(({ column, operator, value }) => {
    const idx = colIndex(column); if (idx === -1) return true;
    const cell = row[idx];
    const cellStr = cell === null || cell === undefined ? "" : String(cell).trim();
    const cellNum = parseFloat(cellStr.replace(/,/g, ""));
    const valNum = parseFloat(String(value).replace(/,/g, ""));
    switch (operator) {
      case "eq":       return cellStr.toLowerCase() === String(value).toLowerCase();
      case "neq":      return cellStr.toLowerCase() !== String(value).toLowerCase();
      case "contains": return cellStr.toLowerCase().includes(String(value).toLowerCase());
      case "gt":       return !isNaN(cellNum) && cellNum > valNum;
      case "gte":      return !isNaN(cellNum) && cellNum >= valNum;
      case "lt":       return !isNaN(cellNum) && cellNum < valNum;
      case "lte":      return !isNaN(cellNum) && cellNum <= valNum;
      default:         return true;
    }
  }));
  const displayCols = columns.filter(c => headers.includes(c));
  const displayRows = filtered.map(row => displayCols.map(col => { const val = row[colIndex(col)]; return val === null || val === undefined ? "" : val; }));
  return { displayCols, displayRows };
}

function FilterTable({ filterSpec, headers, rows }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const { displayCols, displayRows } = applyFilter(headers, rows, filterSpec);
  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);
  const pageRows = displayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (displayRows.length === 0) return <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(4,98,65,0.06)", border: "1px solid rgba(4,98,65,0.15)", fontSize: 12, color: "var(--color-dark-serpent)" }}>No rows matched the filter.</div>;
  return (
    <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(4,98,65,0.2)" }}>
      <div style={{ background: "var(--color-castleton-green)", padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>📋 {filterSpec.title}</span>
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>{displayRows.length} row{displayRows.length !== 1 ? "s" : ""}</span>
      </div>
      <div style={{ overflowX: "auto", background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead><tr>{displayCols.map((col, ci) => <th key={ci} style={{ padding: "6px 10px", background: "rgba(4,98,65,0.08)", borderBottom: "2px solid rgba(4,98,65,0.2)", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", color: "var(--color-dark-serpent)" }}>{col}</th>)}</tr></thead>
          <tbody>{pageRows.map((row, ri) => <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "rgba(4,98,65,0.03)" }}>{row.map((cell, ci) => <td key={ci} style={{ padding: "5px 10px", borderBottom: "1px solid rgba(19,48,32,0.07)", whiteSpace: "nowrap", color: "var(--color-dark-serpent)" }}>{typeof cell === "number" ? cell.toLocaleString() : String(cell)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "rgba(4,98,65,0.04)", borderTop: "1px solid rgba(4,98,65,0.1)" }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(4,98,65,0.25)", background: page === 0 ? "transparent" : "#fff", color: "var(--color-castleton-green)", cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>← Prev</button>
          <span style={{ fontSize: 11, color: "var(--color-text-light)" }}>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(4,98,65,0.25)", background: page === totalPages - 1 ? "transparent" : "#fff", color: "var(--color-castleton-green)", cursor: page === totalPages - 1 ? "default" : "pointer", opacity: page === totalPages - 1 ? 0.4 : 1 }}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Chart state classifier ─────────────────────────────────────────────────────
// Runs fully client-side — no backend needed.
// Returns { action: "update"|"create", updatedState }

function classifyIntent(userText, currentChartState) {
  const t = userText.toLowerCase().trim();

  // Modifiers that indicate the user wants to refine the existing chart
  const modifierPatterns = [
    /\btop\s*\d+\b/,                         // top 5, top 10
    /\blimit\s+(to\s+)?\d+\b/,               // limit to 10
    /\bonly\s+(show\s+)?(top|bottom|first|last)?\s*\d+/,  // only show top 5
    /\bsort\s+(by\s+\w+\s*)?(asc|desc|ascending|descending)\b/,  // sort ascending
    /\border\s+by\b/,                         // order by
    /\bchange\s+(the\s+)?(chart\s+)?type\b/,  // change chart type
    /\bswitch\s+to\s+(bar|line|donut|pie|pivot)\b/,  // switch to bar
    /\bas\s+a?\s*(bar|line|donut|pie|pivot)\b/,  // as a bar chart
    /\bshow\s+as\s+(bar|line|donut|pie)\b/,
    /\bfilter\s+(where|by|above|below|over|under)\b/,  // filter where x > 5
    /\bwhere\s+\w+\s*(>|<|=|is|>=|<=)\b/,    // where value > 10
    /\babove\s+\d+/,                           // above 100
    /\bbelow\s+\d+/,                           // below 100
    /\bgreater\s+than\b/,
    /\bless\s+than\b/,
    /\bexclude\b/,                             // exclude zeros
    /\bremove\s+(the\s+)?\w+\s+from\b/,       // remove X from
    /\binstead\s+of\b/,                        // instead of sum use avg
    /\buse\s+(sum|avg|average|count|max|min)\b/,  // use average instead
    /\bchange\s+(to|from)\b/,
    /\badd\s+(a\s+)?filter\b/,
    /\bmore\s+(results|rows|items)\b/,
    /\bfewer\s+(results|rows|items)\b/,
    /\bthis\s+time\b/,                         // this time show top 3
    /\bnow\s+show\b/,                          // now show top 5
    /\bjust\s+show\b/,
    /\bonly\s+show\b/,
  ];

  // If no current chart is active, always create
  if (!currentChartState) return { action: "create", updatedState: null };

  // Check if this is a modifier
  const isModifier = modifierPatterns.some(p => p.test(t));

  if (isModifier) {
    // Extract updated state from the query
    const updatedState = { ...currentChartState };

    // Update topN / limit
    const topMatch = t.match(/\btop\s*(\d+)\b/) || t.match(/\blimit\s+(?:to\s+)?(\d+)\b/) || t.match(/\bonly\s+(?:show\s+)?(?:top\s+)?(\d+)\b/);
    if (topMatch) updatedState.topN = parseInt(topMatch[1]);

    // Update sort
    if (/\basc(ending)?\b/.test(t)) updatedState.sort = "asc";
    if (/\bdesc(ending)?\b/.test(t)) updatedState.sort = "desc";

    // Update chart type
    const typeMatch = t.match(/\b(bar|line|donut|pie|pivot|horizontal)\b/);
    if (typeMatch) {
      const typeMap = { pie: "donut", horizontal: "hbar" };
      updatedState.chartType = typeMap[typeMatch[1]] || typeMatch[1];
    }

    // Update aggregation
    const aggMatch = t.match(/\b(sum|avg|average|count|max|min)\b/);
    if (aggMatch) updatedState.aggregation = aggMatch[1] === "average" ? "avg" : aggMatch[1];

    // Threshold filter
    const aboveMatch = t.match(/\babove\s+(\d[\d,]*)/);
    const belowMatch = t.match(/\bbelow\s+(\d[\d,]*)/);
    const gtMatch    = t.match(/\bgreater\s+than\s+(\d[\d,]*)/);
    const ltMatch    = t.match(/\bless\s+than\s+(\d[\d,]*)/);
    if (aboveMatch || gtMatch) updatedState.threshold = { op: "gt", value: parseFloat((aboveMatch || gtMatch)[1].replace(/,/g, "")) };
    if (belowMatch || ltMatch) updatedState.threshold = { op: "lt", value: parseFloat((belowMatch || ltMatch)[1].replace(/,/g, "")) };

    return { action: "update", updatedState };
  }

  return { action: "create", updatedState: null };
}

// Apply chart state overrides to a chartSpec returned by the backend
function applyChartState(chartSpec, chartState) {
  if (!chartSpec || !chartState) return chartSpec;
  const merged = { ...chartSpec };
  if (chartState.topN)        merged.topN = chartState.topN;
  if (chartState.sort)        merged.sort = chartState.sort;
  if (chartState.chartType)   merged.type = chartState.chartType;
  if (chartState.aggregation) merged.aggregation = chartState.aggregation;
  if (chartState.threshold)   merged.threshold = chartState.threshold;
  return merged;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DataChatbot({ headers, rows, blueprint, onResult, customCharts = [], filteredTables = [] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: WELCOME, chartSpec: null }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Track the most recently active chart state for follow-up detection
  // { chartId, chartSpec, topN, sort, chartType, aggregation, threshold }
  const [activeChartState, setActiveChartState] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    setMessages([{ role: "assistant", content: WELCOME, chartSpec: null }]);
    setActiveChartState(null);
  }, [headers, rows]);

  const send = async () => { setInput(""); await sendText(input.trim()); };

  const sendText = async (text) => {
    if (!text || loading) return;
    const { action, updatedState } = activeChartState
      ? { action: "update", updatedState: activeChartState }
      : classifyIntent(text, null);

    const userMsg = { role: "user", content: text, chartSpec: null };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${HOST}/chat`, {
        signal: abortRef.current.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => m.content !== WELCOME)
            .map(({ role, content }) => ({ role, content })),
          headers,
          rows,
          datasetSummary: blueprint?.datasetSummary || null,
          currentChartState: activeChartState ? {
            id: activeChartState.chartId,
            type: activeChartState.chartType,
            title: activeChartState.chartSpec?.title,
            x: activeChartState.chartSpec?.x,
            y: activeChartState.chartSpec?.y,
            rowDim: activeChartState.chartSpec?.rowDim,
            colDim: activeChartState.chartSpec?.colDim,
            measure: activeChartState.chartSpec?.measure,
            aggregation: activeChartState.chartSpec?.aggregation,
            limit: activeChartState.topN,
            sort: activeChartState.sort,
            filters: activeChartState.chartSpec?.filters || [],
          } : null,
          existingCharts: customCharts.map(c => ({
            id: c.id,
            title: c.title,
            type: c.type,
            pinned: c.pinned || false,
          })),
          existingTables: (filteredTables || []).map(t => ({
            id: t.id,
            title: t.title,
            pinned: t.pinned || false,
            filters: t.filters || [],
          })),
        }),
      });
      const data = await response.json();
      const steps = data.steps || [];

      // Execute steps in order
      const statusLines = [];
      const newChartSpecs = []; // track charts created in this batch for pinAll

      for (const step of steps) {
        if (step.type === "delete") {
          onResult({ action: "delete", deleteSpec: step });
          if (step.deleteAll) {
            setActiveChartState(null);
            statusLines.push("🗑️ All custom charts deleted.");
          } else {
            if (activeChartState?.chartSpec?.title === step.targetTitle) setActiveChartState(null);
            statusLines.push(`🗑️ "${step.targetTitle}" deleted.`);
          }

        } else if (step.type === "delete_table") {
          // Route as table_action so Dashboard handler picks it up
          const tableStep = step.deleteAll
            ? { action: "deleteAll" }
            : { action: "delete", targetTitle: step.targetTitle };
          onResult({ action: "table_action", tableActionSpec: tableStep });

        } else if (step.type === "pin") {
          // Pass newly created charts so Dashboard can pin them even before state settles
          onResult({ action: "pin", pinSpec: step, newChartSpecs });
          if (step.pinAll) statusLines.push("📌 All charts pinned.");
          else if (step.unpinAll) statusLines.push("📌 All charts unpinned.");
          else statusLines.push(`📌 "${step.targetTitle}" ${step.pinned ? "pinned" : "unpinned"}.`);

        } else if (step.type === "table_action") {
          onResult({ action: "table_action", tableActionSpec: step });
          const act = step.action;
          if (act === "deleteAll") statusLines.push("🗑️ All filtered tables deleted.");
          else if (act === "delete") statusLines.push(`🗑️ Table "${step.targetTitle}" deleted.`);
          else if (act === "pinAll") statusLines.push("📌 All filtered tables pinned.");
          else if (act === "unpinAll") statusLines.push("📌 All filtered tables unpinned.");
          else if (act === "pin") statusLines.push(`📌 "${step.targetTitle}" pinned.`);
          else if (act === "rename") statusLines.push(`✏️ Table renamed to "${step.newTitle}".`);
          else if (act === "sort") statusLines.push(`🔃 "${step.targetTitle}" sorted by ${step.sort_col} (${step.sort_dir || "asc"}).`);
          else if (act === "limit") statusLines.push(`✂️ "${step.targetTitle}" limited to ${step.limit} rows.`);
          else if (act === "add_filter") statusLines.push(`🔍 Filter added to "${step.targetTitle}".`);
          else if (act === "remove_filter") statusLines.push(`🔍 Filter removed from "${step.targetTitle}".`);

        } else if (step.type === "rename") {
          onResult({ action: "rename", renameSpec: step });
          statusLines.push(`✏️ Renamed to "${step.newTitle}".`);

        } else if (step.type === "navigate") {
          onResult({ action: "navigate", tab: step.tab });

        } else if (step.type === "modify_chart") {
          onResult({ action: "modify_chart", modifyChartSpec: step });
          statusLines.push(`📊 "${step.targetTitle}" updated.`);

        } else if (step.type === "filter") {
          onResult({ action: "filter", filterSpec: step });
          statusLines.push("📋 Table added to Summary tab.");

        } else if (step.type === "chart") {
          const spec = { ...step, type: step.chartType || "bar" };
          const isModify = step.action === "modify" && activeChartState?.chartId;

          if (isModify) {
            const resolvedSpec = applyChartState(spec, updatedState || {});
            setActiveChartState(prev => ({ ...prev, chartSpec: resolvedSpec }));
            onResult({ chartSpec: { ...resolvedSpec, targetId: activeChartState.chartId }, action: "modify" });
            statusLines.push("✏️ Chart updated.");
          } else {
            const chartId = Date.now() + Math.random(); // unique id stamped before dispatch
            const specWithId = { ...spec, _chatId: chartId };
            onResult({ chartSpec: specWithId, action: "new" });
            newChartSpecs.push(specWithId);
            statusLines.push("📊 Chart added to Charts tab.");
          }
        }
      }

      // Compose final message
      const replyContent = [data.reply, ...statusLines].filter(Boolean).join("\n");
      const finalReply = replyContent || "Done.";
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: finalReply,
        chartSpec: null,
        suggestions: generateFollowUps(finalReply, steps),
      }]);
    } catch (err) {
      if (err?.name !== "AbortError") {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: "Couldn't reach the server. Is the backend running?",
          chartSpec: null,
        }]);
      }
    }
    setLoading(false);
    abortRef.current = null;
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: "Stopped.",
      chartSpec: null,
    }]);
  };


  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Generate contextual follow-up suggestions after each reply
  const generateFollowUps = (replyText, steps = []) => {
    const reply = (replyText || "").toLowerCase();
    const suggestions = [];

    // Detect what action(s) were just taken from steps
    const stepTypes = steps.map(s => s.type);
    const tableActions = steps.filter(s => s.type === "table_action").map(s => s.action);
    const madeChart = stepTypes.includes("chart");
    const madeFilter = stepTypes.includes("filter");
    const deletedTables = tableActions.includes("deleteAll") || tableActions.includes("delete");
    const pinned = stepTypes.includes("pin") || tableActions.includes("pin") || tableActions.includes("pinAll");
    const sorted = tableActions.includes("sort");
    const limited = tableActions.includes("limit");
    const renamed = tableActions.includes("rename") || stepTypes.includes("rename");
    const navigated = stepTypes.includes("navigate");

    // Step-based smart suggestions
    if (madeChart) {
      suggestions.push("Pin this chart");
      suggestions.push("Show top 20 instead");
      suggestions.push("Make it a horizontal bar chart");
    }
    if (madeFilter) {
      suggestions.push("Pin this table");
      suggestions.push("Show me a bar chart of this result");
      suggestions.push("Delete all filter tables");
    }
    if (deletedTables) {
      suggestions.push("Create a new filter table");
      suggestions.push("Summarize the full dataset");
      suggestions.push("Show top 10 by count");
    }
    if (pinned) {
      suggestions.push("Go to Charts tab");
      suggestions.push("Create another chart");
      suggestions.push("Summarize this dataset");
    }
    if (sorted || limited) {
      suggestions.push("Pin this table");
      suggestions.push("Show me a chart of this");
      suggestions.push("Reset to show all rows");
    }
    if (renamed || navigated) {
      suggestions.push("Summarize this dataset");
      suggestions.push("Show me the top 10 rows");
      suggestions.push("Create a chart");
    }

    // Reply-text based (fallback when steps don't give enough signal)
    if (suggestions.length === 0) {
      if (reply.includes("top") || reply.includes("rank") || reply.includes("highest") || reply.includes("most")) {
        suggestions.push("Show bottom 5 instead");
        suggestions.push("Make a bar chart of this");
        suggestions.push("Filter to just the top result");
      } else if (reply.includes("total") || reply.includes("sum") || reply.includes("count") || reply.includes("average")) {
        suggestions.push("Break this down by month");
        suggestions.push("Show as a bar chart");
        suggestions.push("Compare by category");
      } else if (reply.includes("filter") || reply.includes("rows where")) {
        suggestions.push("Show me a chart of this result");
        suggestions.push("Pin this table");
        suggestions.push("Clear all filters");
      } else if (reply.includes("summarize") || reply.includes("dataset") || reply.includes("column")) {
        suggestions.push("Show top 10 by count");
        suggestions.push("Create a pivot table by month");
        suggestions.push("What is the total count per site?");
      } else {
        // Skip index/ID/serial-like columns
        const skipPattern = /^(no\.?|id|#|index|row|num|number|serial|s\.?no\.?)$/i;
        const isIndexCol = (h) => skipPattern.test(h.trim());

        const meaningfulNumeric = headers?.find(h => {
          if (isIndexCol(h)) return false;
          const vals = (rows || []).slice(0, 30).map(r => r[headers.indexOf(h)]).filter(v => v != null && String(v).trim() !== "");
          const numCount = vals.filter(v => !isNaN(parseFloat(String(v).replace(/,/g, "")))).length;
          // Must be numeric but NOT a sequential index (check variance)
          if (numCount / vals.length < 0.7) return false;
          const nums = vals.map(v => parseFloat(String(v).replace(/,/g, ""))).filter(n => !isNaN(n));
          const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
          const allSameOrSeq = nums.every((n, i) => i === 0 || Math.abs(n - nums[i - 1]) === 1);
          return !allSameOrSeq && mean !== nums.length / 2;
        });

        const meaningfulCat = headers?.find(h => {
          if (isIndexCol(h)) return false;
          const vals = (rows || []).slice(0, 30).map(r => r[headers.indexOf(h)]).filter(v => v != null && String(v).trim() !== "");
          const unique = new Set(vals.map(v => String(v).trim().toLowerCase())).size;
          return unique >= 2 && unique <= 30 && unique < vals.length * 0.8;
        });

        if (meaningfulNumeric && meaningfulCat) suggestions.push(`Total ${meaningfulNumeric} per ${meaningfulCat}`);
        else if (meaningfulCat) suggestions.push(`Count rows by ${meaningfulCat}`);
        if (meaningfulCat) suggestions.push(`Top 10 by ${meaningfulCat}`);
        else suggestions.push("Show me the top 10 rows");
        suggestions.push("Summarize this dataset");
        suggestions.push("Create a pivot table");
      }
    }

    // Dedupe and cap at 3
    return [...new Set(suggestions)].slice(0, 3);
  };

    const suggestedQuestions = useMemo(() => {
    if (!headers || !rows || rows.length === 0) return ["Summarize this dataset"];
    const skipPattern = /^(no\.?|id|#|index|row|num|number|serial|s\.?no\.?)$/i;
    const suggestions = [];
    const numericCols = [], categoryCols = [];
    headers.forEach(col => {
      if (skipPattern.test(col.trim())) return;
      const vals = rows.map(r => r[headers.indexOf(col)]).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
      if (!vals.length) return;
      const numCount = vals.filter(v => !isNaN(parseFloat(String(v).replace(/,/g, "")))).length;
      const uniqueCount = new Set(vals.map(v => String(v).trim().toLowerCase())).size;
      const uniqueRatio = uniqueCount / vals.length;
      // Skip sequential index-like numeric columns
      if (numCount / vals.length >= 0.7) {
        const nums = vals.slice(0, 20).map(v => parseFloat(String(v).replace(/,/g, ""))).filter(n => !isNaN(n));
        const isSeq = nums.every((n, i) => i === 0 || Math.abs(n - nums[i-1]) === 1);
        if (!isSeq) numericCols.push(col);
      } else if (uniqueRatio < 0.6 && uniqueCount >= 2 && uniqueCount <= 50) categoryCols.push(col);
    });
    suggestions.push("Summarize this dataset");
    if (numericCols.length > 0) suggestions.push(`Who are the top 5 by ${numericCols[numericCols.length - 1]}?`);
    if (categoryCols.length > 0) {
      const col = categoryCols[0];
      const vals = rows.map(r => r[headers.indexOf(col)]).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
      const freq = {};
      vals.forEach(v => { const k = String(v).trim(); freq[k] = (freq[k] || 0) + 1; });
      const topVal = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topVal) suggestions.push(`Show me rows where ${col} is "${topVal}"`);
      else suggestions.push(`Filter by ${col}`);
    }
    if (numericCols.length > 0 && categoryCols.length > 0) suggestions.push(`What is the total ${numericCols[numericCols.length - 1]} per ${categoryCols[0]}?`);
    else if (categoryCols.length > 1) suggestions.push(`How many unique values are in ${categoryCols[1]}?`);
    else suggestions.push("How many rows are in this dataset?");
    return suggestions.slice(0, 4);
  }, [headers, rows]);

  // Active chart state pill — shows what chart is being "tracked" for follow-ups

  const ChartSelector = () => {
    if (customCharts.length === 0) return null;
    const activeId = activeChartState?.chartId ? String(activeChartState.chartId) : "";
    const typeIcon = (type) => ({ bar:"📊", hbar:"📊", line:"📈", donut:"🍩", pivot:"🗂️" }[type] || "📊");

    const handleSelect = (e) => {
      const val = e.target.value;
      if (!val) { setActiveChartState(null); return; }
      const chart = customCharts.find(c => String(c.id) === val);
      if (!chart) return;
      setActiveChartState({
        chartId: chart.id,
        chartType: chart.type,
        chartSpec: chart.spec || chart,
        topN: chart.spec?.limit || null,
        sort: chart.spec?.sort || null,
        aggregation: chart.spec?.aggregation || null,
      });
    };

    return (
      <div style={{
        margin: "0 4px 8px",
        padding: "7px 10px",
        borderRadius: 8,
        background: "rgba(4,98,65,0.07)",
        border: `1px solid ${activeId ? "rgba(4,98,65,0.35)" : "rgba(4,98,65,0.15)"}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 12, flexShrink: 0 }}>✏️</span>
        <select
          value={activeId}
          onChange={handleSelect}
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 600,
            color: activeId ? "var(--color-castleton-green)" : "var(--color-text-light)",
            backgroundColor: BRAND.white,
            border: "none",
            outline: "none",
            cursor: "pointer",
            minWidth: 0,
            colorScheme: "dark",
          }}
        >
          <option value="" style={{ backgroundColor: BRAND.white, color: BRAND.dark }}>Select a chart to edit…</option>
          {customCharts.map(c => (
            <option key={c.id} value={String(c.id)} style={{ backgroundColor: BRAND.white, color: BRAND.dark }}>
              {typeIcon(c.type)} {c.title}
            </option>
          ))}
        </select>
        {activeId && (
          <button
            onClick={() => setActiveChartState(null)}
            style={{ width: 24, height: 24, borderRadius: 8, background: BRAND.white, border: `1px solid ${BRAND.border}`, cursor: "pointer", fontSize: 14, color: BRAND.dark, padding: 0, lineHeight: 1, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            title="Stop editing"
          >×</button>
        )}
      </div>
    );
  };
  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .data-chatbot-toggle {
            right: 16px !important;
            bottom: 16px !important;
          }
          .data-chatbot-panel {
            right: 8px !important;
            left: 8px !important;
            bottom: 84px !important;
            width: auto !important;
            max-width: none !important;
            height: min(72vh, 620px) !important;
          }
        }
      `}</style>
      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="data-chatbot-toggle fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all duration-200 cursor-pointer border-none"
        style={{
          color: open ? BRAND.dark : BRAND.white,
          backgroundColor: open ? BRAND.white : BRAND.green,
          border: `1px solid ${open ? BRAND.border : "rgba(255,255,255,0.18)"}`,
          boxShadow: open ? "0 10px 24px rgba(0,0,0,0.22)" : "0 12px 26px rgba(4,98,65,0.28)",
          transform: open ? "scale(0.92)" : "scale(1)",
        }}
        title="Ask about your data"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          className="data-chatbot-panel fixed bottom-24 right-6 z-50 w-[460px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "600px", backgroundColor: BRAND.surface, border: `1px solid ${BRAND.border}`, color: BRAND.dark }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ backgroundColor: BRAND.header }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ backgroundColor: BRAND.green }}>🤖</div>
            <div>
              <div className="font-bold text-sm leading-tight" style={{ color: BRAND.white }}>Data LifeSights Assistant</div>
              <div className="text-xs" style={{ color: "rgba(255, 255, 255, 0.75)" }}>Full dataset access · {rows.length.toLocaleString()} rows</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: BRAND.saffron }} />
              <span className="text-xs" style={{ color: "rgba(255, 255, 255, 0.75)" }}>Live</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ backgroundColor: BRAND.soft }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0" style={{ backgroundColor: "rgba(4, 98, 65, 0.12)" }}>🤖</div>
                  )}
                  <div
                    className="max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={msg.role === "user"
                      ? { backgroundColor: BRAND.green, color: "#fff", borderBottomRightRadius: 8, whiteSpace: "pre-wrap" }
                      : { backgroundColor: BRAND.white, color: BRAND.dark, border: `1px solid ${BRAND.border}`, borderBottomLeftRadius: 8 }}
                  >
                    {msg.role === "assistant" ? <MarkdownMessage text={msg.content} /> : msg.content}
                  </div>
                </div>

                {/* Follow-up suggestions — only on last assistant message */}
                {msg.role === "assistant" && msg.suggestions && i === messages.length - 1 && !loading && (
                  <div className="ml-8 mt-2 flex flex-col gap-1.5">
                    {msg.suggestions.map((q, si) => (
                      <button key={si}
                        onClick={() => sendText(q)}
                        className="text-left px-3 py-2 rounded-xl text-xs cursor-pointer"
                        style={{
                          backgroundColor: BRAND.green,
                          border: "none",
                          color: "#fff",
                          fontWeight: 600,
                          opacity: 0.82,
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "0.82"}
                      >
                        ↩ {q}
                      </button>
                    ))}
                  </div>
                )}

              </div>
            ))}

            {/* Suggested questions */}
            {messages.length === 1 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-xs font-medium px-1" style={{ color: BRAND.muted }}>Try asking:</p>
                {suggestedQuestions.map((q, i) => (
                  <button key={i} onClick={() => sendText(q)}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.border}`, color: BRAND.dark }}
                  >{q}</button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0" style={{ backgroundColor: "rgba(4, 98, 65, 0.12)" }}>🤖</div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5" style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.border}` }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: BRAND.saffron, animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: BRAND.saffron, animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: BRAND.saffron, animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0" style={{ borderTop: `1px solid ${BRAND.border}`, backgroundColor: BRAND.white }}>
            <ChartSelector />
            <div className="px-3 pb-3 pt-2 flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about your data..."
                rows={1}
                className="flex-1 px-3.5 py-2.5 rounded-xl text-sm resize-none leading-snug"
                style={{ maxHeight: "100px", overflowY: "auto", border: `1px solid ${BRAND.border}`, color: BRAND.dark, outline: "none" }}
              />
              {loading ? (
                <button
                  onClick={stop}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 border-none cursor-pointer text-white"
                  style={{ backgroundColor: "#e53e3e", fontSize: 13 }}
                  title="Stop generating"
                >
                  ⏹
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base transition-all shrink-0 border-none cursor-pointer"
                  style={{ backgroundColor: input.trim() ? BRAND.green : "rgba(19, 48, 32, 0.25)" }}
                >
                  ↑
                </button>
              )}
            </div>
          </div>

          <div className="px-4 py-1.5 text-center shrink-0" style={{ backgroundColor: BRAND.soft, borderTop: `1px solid ${BRAND.border}` }}>
            <span className="text-xs" style={{ color: BRAND.muted }}>
              {loading ? "Generating… click to stop" : "Enter to send · Shift+Enter for new line"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
