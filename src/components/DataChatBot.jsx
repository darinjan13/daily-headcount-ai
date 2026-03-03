import { useState, useRef, useEffect } from "react";

const WELCOME = "Hi! I have access to your full dataset and can answer precise questions — totals, rankings, breakdowns, anything. What would you like to know?";

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
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => m.content !== WELCOME)
            .map(({ role, content }) => ({ role, content })),
          headers,
          rows,   // send ALL rows — backend handles full CSV
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
        { role: "assistant", content: "Couldn't reach the server. Is the backend running?", chartSpec: null },
      ]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const suggestedQuestions = [
    "Who has the most entries?",
    "What's the total for each category?",
    "Show me the top 5 by count",
    "Summarize this dataset",
  ];

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white text-2xl transition-all duration-200 cursor-pointer border-none ${
          open ? "bg-gray-500 scale-90" : "bg-emerald-700 hover:bg-emerald-800 hover:scale-110"
        }`}
        title="Ask about your data"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ height: "560px" }}
        >
          {/* Header */}
          <div className="bg-emerald-700 px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-base">🤖</div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Data Assistant</div>
              <div className="text-emerald-300 text-xs">Full dataset access · {rows.length.toLocaleString()} rows</div>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 text-xs">Live</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0">🤖</div>
                  )}
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-emerald-700 text-white rounded-br-sm"
                        : "bg-white text-gray-700 shadow-sm border border-gray-100 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>

                {/* Add to Dashboard button — shown when AI returns a chart spec */}
                {msg.role === "assistant" && msg.chartSpec && (
                  <div className="ml-8 mt-1.5">
                    <button
                      onClick={() => {
                        onAddChart(msg.chartSpec);
                        // Visual feedback — replace spec with confirmation
                        setMessages((prev) =>
                          prev.map((m, idx) =>
                            idx === i ? { ...m, chartSpec: null, added: true } : m
                          )
                        );
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      <span>📊</span>
                      Add to Dashboard
                    </button>
                  </div>
                )}
                {msg.role === "assistant" && msg.added && (
                  <div className="ml-8 mt-1 text-xs text-emerald-600 font-medium">✓ Added to dashboard</div>
                )}
              </div>
            ))}

            {/* Suggested questions */}
            {messages.length === 1 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-xs text-gray-400 font-medium px-1">Try asking:</p>
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Loading dots */}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0">🤖</div>
                <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 bg-white flex gap-2 items-end shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your data..."
              rows={1}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 leading-snug"
              style={{ maxHeight: "100px", overflowY: "auto" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-base transition-all shrink-0 border-none cursor-pointer ${
                input.trim() && !loading ? "bg-emerald-700 hover:bg-emerald-800" : "bg-gray-200 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : "↑"}
            </button>
          </div>

          <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100 text-center shrink-0">
            <span className="text-xs text-gray-300">Enter to send · Shift+Enter for new line</span>
          </div>
        </div>
      )}
    </>
  );
}