import { useChat } from "@ai-sdk/react";
import { Send, Bot, User, Loader2, AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";

export default function Chat() {
  // In the latest AI SDK v7+, we manage input locally and use status/sendMessage
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err) => {
      // Vercel AI SDK strips out the raw API error for security reasons and sends generic messages
      // like "An error occurred." or "No output generated." 
      // Because we know the most common cause is hitting the free-tier Gemini API quota, we show a unified error.
      const msg = err?.message || "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Too many")) {
        setError("API quota exceeded. Please wait a minute before sending another message.");
      } else {
        setError("The AI service is unavailable or your API quota has been exceeded. Please wait a minute and try again.");
      }
    },
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const isLoading = status === "submitted" || status === "streaming";

  // Auto-dismiss the error after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-scroll to the bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    setError(null); // Clear any previous error
    const userMessage = input;
    setInput(""); // Clear immediately
    
    // Send to the API
    await sendMessage({ text: userMessage });
  };

  return (
    <div className="w-full h-full max-w-5xl mx-auto flex flex-col bg-neutral-900/40 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden relative">
      
      {/* Header / Telemetry Indicator */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center space-x-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <span className="text-sm font-medium text-neutral-300">Lexicon AI Active</span>
        </div>
        <div className="text-xs font-mono text-neutral-500 bg-black/20 px-2 py-1 rounded-md border border-white/5">
          Redis Caching Enabled
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-4 animate-in fade-in duration-700">
            <Bot className="w-12 h-12 text-neutral-700" />
            <p className="text-lg">What would you like to know about this document?</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`flex max-w-[85%] ${
                  m.role === "user" ? "flex-row-reverse" : "flex-row"
                } items-start gap-4`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                      : "bg-white/10 text-emerald-400 border border-white/10"
                  }`}
                >
                  {m.role === "user" ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                
                {/* Message Bubble */}
                <div
                  className={`px-5 py-4 rounded-3xl shadow-sm ${
                    m.role === "user"
                      ? "bg-white text-black rounded-tr-sm"
                      : "bg-white/5 border border-white/10 text-neutral-200 rounded-tl-sm"
                  }`}
                >
                  <div className={`leading-relaxed text-[15px] prose prose-sm max-w-none ${m.role === "user" ? "" : "prose-invert"}`}>
                    {m.parts?.map((part: any, i: number) => 
                      part.type === 'text' ? <ReactMarkdown key={i}>{part.text}</ReactMarkdown> : null
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="flex items-start gap-4 max-w-[85%]">
              <div className="w-10 h-10 rounded-full bg-white/10 text-emerald-400 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="px-5 py-4 rounded-3xl rounded-tl-sm bg-white/5 border border-white/10 flex items-center space-x-3">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span className="text-neutral-400 text-sm font-medium tracking-wide">Synthesizing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white/[0.02] border-t border-white/10">
        <form
          onSubmit={onSubmit}
          className="flex items-center bg-black/40 border border-white/10 rounded-2xl overflow-hidden focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all shadow-inner"
        >
          <input
            className="flex-1 bg-transparent px-5 py-4 text-neutral-200 focus:outline-none placeholder-neutral-600 text-[15px]"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="mr-2 p-3 bg-white text-black hover:bg-neutral-200 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

