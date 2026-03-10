import { useState, useRef, useEffect, useMemo } from "react";

const WELCOME = "Hi! I have access to your full dataset and can answer precise questions — totals, rankings, breakdowns, anything. What would you like to know?";

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
// Handles: **bold**, *italic*, `code`, ## headers, numbered lists, bullet lists,
// markdown tables, and --- dividers. No external dependency needed.

function MarkdownMessage({ text }) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // --- divider
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: "none", borderTop: "1px solid rgba(19,48,32,0.12)", margin: "8px 0" }} />);
      i++;
      continue;
    }

    // ## heading
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#{1,3})/)[1].length;
      const txt = line.replace(/^#{1,3}\s+/, "");
      const sizes = { 1: "15px", 2: "13px", 3: "12px" };
      elements.push(
        <div key={i} style={{ fontWeight: 800, fontSize: sizes[level], color: "var(--color-dark-serpent)", marginTop: 10, marginBottom: 4 }}>
          {renderInline(txt)}
        </div>
      );
      i++;
      continue;
    }

    // markdown table — collect all consecutive | lines
    if (line.trim().startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines
        .filter(l => !/^\s*\|[-| :]+\|\s*$/.test(l)) // skip separator row
        .map(l => l.replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
      if (rows.length > 0) {
        elements.push(
          <div key={`table-${i}`} style={{ overflowX: "auto", margin: "8px 0" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>
              <thead>
                <tr>
                  {rows[0].map((cell, ci) => (
                    <th key={ci} style={{ padding: "5px 10px", background: "rgba(4,98,65,0.1)", borderBottom: "2px solid rgba(4,98,65,0.2)", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(4,98,65,0.04)" }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ padding: "5px 10px", borderBottom: "1px solid rgba(19,48,32,0.08)" }}>
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // numbered list item: "1. " or "1) "
    if (/^\d+[.)]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: "6px 0", paddingLeft: "20px", listStyleType: "decimal" }}>
          {listItems.map((item, li) => (
            <li key={li} style={{ marginBottom: "3px", fontSize: "13px", lineHeight: "1.5" }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // bullet list: "- " or "• "
    if (/^[-•]\s/.test(line)) {
      const listItems = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^[-•]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: "6px 0", paddingLeft: "18px", listStyleType: "disc" }}>
          {listItems.map((item, li) => (
            <li key={li} style={{ marginBottom: "3px", fontSize: "13px", lineHeight: "1.5" }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // blank line → small gap
    if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: "6px" }} />);
      i++;
      continue;
    }

    // regular paragraph
    elements.push(
      <p key={i} style={{ margin: "3px 0", fontSize: "13px", lineHeight: "1.6" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div style={{ fontFamily: "inherit" }}>{elements}</div>;
}

// Renders inline markdown: **bold**, *italic*, `code`, and plain text
function renderInline(text) {
  const parts = [];
  // pattern matches **bold**, *italic*, `code` in order
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      parts.push(
        <code key={key++} style={{ background: "rgba(4,98,65,0.1)", borderRadius: "3px", padding: "1px 5px", fontSize: "12px", fontFamily: "monospace", color: "var(--color-dark-serpent)" }}>
          {match[4]}
        </code>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : parts;
}

// ── FilterTable ───────────────────────────────────────────────────────────────
// Applies filterSpec conditions to the full rows/headers and renders a mini table

function applyFilter(headers, rows, filterSpec) {
  const { columns, filters } = filterSpec;
  const colIndex = (name) => headers.indexOf(name);

  const filtered = rows.filter(row => {
    return filters.every(({ column, operator, value }) => {
      const idx = colIndex(column);
      if (idx === -1) return true;
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
    });
  });

  // only keep the requested display columns, in order
  const displayCols = columns.filter(c => headers.includes(c));
  const displayRows = filtered.map(row =>
    displayCols.map(col => {
      const val = row[colIndex(col)];
      return val === null || val === undefined ? "" : val;
    })
  );

  return { displayCols, displayRows };
}

function FilterTable({ filterSpec, headers, rows }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { displayCols, displayRows } = applyFilter(headers, rows, filterSpec);
  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);
  const pageRows = displayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (displayRows.length === 0) {
    return (
      <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(4,98,65,0.06)", border: "1px solid rgba(4,98,65,0.15)", fontSize: 12, color: "var(--color-dark-serpent)" }}>
        No rows matched the filter.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(4,98,65,0.2)" }}>
      {/* Table header bar */}
      <div style={{ background: "var(--color-castleton-green)", padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>
          📋 {filterSpec.title}
        </span>
        <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>
          {displayRows.length} row{displayRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: "auto", background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              {displayCols.map((col, ci) => (
                <th key={ci} style={{
                  padding: "6px 10px",
                  background: "rgba(4,98,65,0.08)",
                  borderBottom: "2px solid rgba(4,98,65,0.2)",
                  textAlign: "left",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  color: "var(--color-dark-serpent)",
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "rgba(4,98,65,0.03)" }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{
                    padding: "5px 10px",
                    borderBottom: "1px solid rgba(19,48,32,0.07)",
                    whiteSpace: "nowrap",
                    color: "var(--color-dark-serpent)",
                  }}>
                    {typeof cell === "number" ? cell.toLocaleString() : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "rgba(4,98,65,0.04)", borderTop: "1px solid rgba(4,98,65,0.1)" }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(4,98,65,0.25)", background: page === 0 ? "transparent" : "#fff", color: "var(--color-castleton-green)", cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1 }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 11, color: "var(--color-text-light)" }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(4,98,65,0.25)", background: page === totalPages - 1 ? "transparent" : "#fff", color: "var(--color-castleton-green)", cursor: page === totalPages - 1 ? "default" : "pointer", opacity: page === totalPages - 1 ? 0.4 : 1 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DataChatbot({ headers, rows, blueprint, onResult }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: WELCOME, chartSpec: null }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Reset when new file loaded
  useEffect(() => {
    setMessages([{ role: "assistant", content: WELCOME, chartSpec: null }]);
  }, [headers, rows]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, chartSpec: null };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("https://daily-headcount-ai-backend.onrender.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => m.content !== WELCOME)
            .map(({ role, content }) => ({ role, content })),
          headers,
          rows,
          datasetSummary: blueprint?.datasetSummary || null,
        }),
      });
      const data = await response.json();
      // Filter tables go to home automatically — no button needed
      if (data.filterSpec) {
        onResult({ chartSpec: null, filterSpec: data.filterSpec });
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          chartSpec: data.chartSpec || null,
          filterSpec: null, // already sent to dashboard, no need to show button
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Couldn't reach the server. Is the backend running?", chartSpec: null },
      ]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const suggestedQuestions = useMemo(() => {
    if (!headers || !rows || rows.length === 0) return ["Summarize this dataset"];

    const suggestions = [];

    // Detect column types
    const numericCols = [];
    const categoryCols = [];

    headers.forEach(col => {
      const vals = rows.map(r => r[headers.indexOf(col)]).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
      if (!vals.length) return;
      const numCount = vals.filter(v => !isNaN(parseFloat(String(v).replace(/,/g, "")))).length;
      const uniqueCount = new Set(vals.map(v => String(v).trim().toLowerCase())).size;
      const uniqueRatio = uniqueCount / vals.length;
      if (numCount / vals.length >= 0.7) numericCols.push(col);
      else if (uniqueRatio < 0.6 && uniqueCount >= 2 && uniqueCount <= 50) categoryCols.push(col);
    });

    // 1. Always: summarize
    suggestions.push("Summarize this dataset");

    // 2. Top N by best numeric col
    if (numericCols.length > 0) {
      const col = numericCols[numericCols.length - 1]; // last numeric tends to be the main metric
      suggestions.push(`Who are the top 5 by ${col}?`);
    }

    // 3. Filter by a category col
    if (categoryCols.length > 0) {
      const col = categoryCols[0];
      // pick a sample value from that column
      const vals = rows.map(r => r[headers.indexOf(col)]).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
      const freq = {};
      vals.forEach(v => { const k = String(v).trim(); freq[k] = (freq[k] || 0) + 1; });
      const topVal = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topVal) suggestions.push(`Show me rows where ${col} is "${topVal}"`);
      else suggestions.push(`Filter by ${col}`);
    }

    // 4. Breakdown numeric by category
    if (numericCols.length > 0 && categoryCols.length > 0) {
      suggestions.push(`What is the total ${numericCols[numericCols.length - 1]} per ${categoryCols[0]}?`);
    } else if (categoryCols.length > 1) {
      suggestions.push(`How many unique values are in ${categoryCols[1]}?`);
    } else {
      suggestions.push(`How many rows are in this dataset?`);
    }

    return suggestions.slice(0, 4);
  }, [headers, rows]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all duration-200 cursor-pointer border-none"
        style={{
          color: BRAND.white,
          backgroundColor: open ? "rgba(4, 98, 65, 0.4)" : BRAND.green,
           transform: open ? "scale(0.92)" : "scale(1)",
         }}
        title="Ask about your data"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[460px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            height: "600px",
            backgroundColor: BRAND.surface,
            border: `1px solid ${BRAND.border}`,
            color: BRAND.dark,
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ backgroundColor: BRAND.header }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ backgroundColor: BRAND.green }}>🤖</div>
            <div>
              <div className="font-bold text-sm leading-tight" style={{ color: BRAND.white }}>Data Assistant</div>
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
                    {msg.role === "assistant"
                      ? <MarkdownMessage text={msg.content} />
                      : msg.content
                    }
                  </div>
                </div>

                {/* Add Chart to Charts button — only for chart specs */}
                {msg.role === "assistant" && msg.chartSpec && (
                  <div className="ml-8 mt-1.5">
                    <button
                      onClick={() => {
                        onResult({ chartSpec: msg.chartSpec, filterSpec: null });
                        setMessages((prev) =>
                          prev.map((m, idx) =>
                            idx === i ? { ...m, chartSpec: null, added: true } : m
                          )
                        );
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      style={{ backgroundColor: "rgba(4, 98, 65, 0.08)", border: "1px solid rgba(4,98,65,0.28)", color: BRAND.green }}
                    >
                      <span>📊</span> Add Chart to Charts
                    </button>
                  </div>
                )}
                {msg.role === "assistant" && msg.added && (
                  <div className="ml-8 mt-1 text-xs font-medium" style={{ color: BRAND.green }}>✓ Chart added to Charts tab</div>
                )}
              </div>
            ))}

            {/* Suggested questions */}
            {messages.length === 1 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-xs font-medium px-1" style={{ color: BRAND.muted }}>Try asking:</p>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.border}`, color: BRAND.dark }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Loading dots */}
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
          <div className="px-3 py-3 flex gap-2 items-end shrink-0" style={{ borderTop: `1px solid ${BRAND.border}`, backgroundColor: BRAND.white }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your data..."
              rows={1}
              className="flex-1 px-3.5 py-2.5 rounded-xl text-sm resize-none leading-snug"
              style={{
                maxHeight: "100px",
                overflowY: "auto",
                border: `1px solid ${BRAND.border}`,
                color: BRAND.dark,
                outline: "none",
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base transition-all shrink-0 border-none cursor-pointer"
              style={{ backgroundColor: input.trim() && !loading ? BRAND.green : "rgba(19, 48, 32, 0.25)" }}
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : "↑"}
            </button>
          </div>

          <div className="px-4 py-1.5 text-center shrink-0" style={{ backgroundColor: BRAND.soft, borderTop: `1px solid ${BRAND.border}` }}>
            <span className="text-xs" style={{ color: BRAND.muted }}>Enter to send · Shift+Enter for new line</span>
          </div>
        </div>
      )}
    </>
  );
}