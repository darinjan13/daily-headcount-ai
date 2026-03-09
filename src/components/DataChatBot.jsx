import { useEffect, useRef, useState } from "react";

const WELCOME = "Hi! I can answer questions about your full dataset. Ask for totals, rankings, trends, or breakdowns.";

const BRAND = {
  deep: "var(--color-dark-serpent)",
  text: "var(--color-text)",
  green: "var(--color-castleton-green)",
  saffron: "var(--color-saffron)",
  white: "var(--color-white)",
  muted: "var(--color-text-light)",
  border: "var(--color-border)",
  soft: "var(--color-surface-soft)",
  chip: "var(--color-chip-bg)",
};

export default function DataChatbot({ headers, rows, blueprint, onAddChart }) {
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

  useEffect(() => {
    setMessages([{ role: "assistant", content: WELCOME, chartSpec: null }]);
  }, [headers, rows]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, chartSpec: null };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("https://daily-headcount-ai-backend.onrender.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages
            .filter((m) => m.content !== WELCOME)
            .map(({ role, content }) => ({ role, content })),
          headers,
          rows,
          datasetSummary: blueprint?.datasetSummary || null,
        }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, chartSpec: data.chartSpec || null },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Could not reach the server. Check backend connectivity.", chartSpec: null },
      ]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const suggestedQuestions = [
    "Who has the most entries?",
    "What is the total per category?",
    "Show the top 5 by count",
    "Summarize this dataset",
  ];

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 cursor-pointer border-none"
        style={{
          color: "#FFFFFF",
          backgroundColor: open ? "var(--color-border-strong)" : BRAND.green,
          transform: open ? "scale(0.92)" : "scale(1)",
          fontSize: 22,
        }}
        title="Ask about your data"
        aria-label="Ask about your data"
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            height: "560px",
            backgroundColor: BRAND.white,
            border: `1px solid ${BRAND.border}`,
          }}
        >
          <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ backgroundColor: BRAND.deep }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: "var(--color-castleton-green)",
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.35)",
              }}
            >
              AI
            </div>
            <div>
              <div className="font-bold text-sm leading-tight" style={{ color: "#FFFFFF" }}>Data Assistant</div>
              <div className="text-xs" style={{ color: "#FFFFFF" }}>
                Full dataset access · {rows.length.toLocaleString()} rows
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: BRAND.saffron }} />
              <span className="text-xs" style={{ color: "#FFFFFF" }}>Live</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ backgroundColor: BRAND.soft }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                  {msg.role === "assistant" && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 mt-0.5 shrink-0 font-bold"
                      style={{
                        backgroundColor: "var(--color-castleton-green)",
                        color: "#FFFFFF",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                      }}
                    >
                      AI
                    </div>
                  )}
                  <div
                    className="max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={
                      msg.role === "user"
                        ? { backgroundColor: BRAND.green, color: BRAND.white, borderBottomRightRadius: 8 }
                        : { backgroundColor: BRAND.white, color: BRAND.text, border: `1px solid ${BRAND.border}`, borderBottomLeftRadius: 8 }
                    }
                  >
                    {msg.content}
                  </div>
                </div>

                {msg.role === "assistant" && msg.chartSpec && (
                  <div className="ml-8 mt-1.5">
                    <button
                      onClick={() => {
                        onAddChart(msg.chartSpec);
                        setMessages((prev) =>
                          prev.map((m, idx) => (idx === i ? { ...m, chartSpec: null, added: true } : m))
                        );
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      style={{ backgroundColor: BRAND.chip, border: `1px solid ${BRAND.border}`, color: BRAND.green }}
                    >
                      Add to Dashboard
                    </button>
                  </div>
                )}

                {msg.role === "assistant" && msg.added && (
                  <div className="ml-8 mt-1 text-xs font-medium" style={{ color: BRAND.green }}>
                    Added to dashboard
                  </div>
                )}
              </div>
            ))}

            {messages.length === 1 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-xs font-medium px-1" style={{ color: BRAND.muted }}>Try asking:</p>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.border}`, color: BRAND.text }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] mr-2 mt-0.5 shrink-0 font-bold"
                  style={{
                    backgroundColor: "var(--color-castleton-green)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                  }}
                >
                  AI
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5" style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.border}` }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: BRAND.saffron, animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: BRAND.saffron, animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: BRAND.saffron, animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

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
                color: BRAND.text,
                outline: "none",
                backgroundColor: BRAND.white,
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base transition-all shrink-0 border-none cursor-pointer"
              style={{ backgroundColor: input.trim() && !loading ? BRAND.green : "var(--color-border)" }}
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

