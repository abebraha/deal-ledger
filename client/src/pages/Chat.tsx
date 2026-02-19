import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Loader2, Save, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApp } from "@/lib/context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  saved?: boolean;
  userPrompt?: string;
}

export function ChatInterface() {
  const { accountId } = useApp();
  const { toast } = useToast();
  const qc = useQueryClient();
  const base = `/api/accounts/${accountId}`;
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "Hello! I can generate custom reports on your pipeline, activities, and team performance. Ask me anything and I'll create a report you can save to your Reports tab." }
  ]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSave = async (index: number) => {
    const msg = messages[index];
    if (!msg || msg.role !== "ai" || !msg.content || msg.saved) return;

    setSavingIndex(index);
    try {
      const promptText = msg.userPrompt || "Custom AI Report";
      const titleText = promptText.length > 80 ? promptText.substring(0, 80) + "..." : promptText;
      await apiRequest("POST", `${base}/reports/save-custom`, {
        title: `Custom: ${titleText}`,
        content: msg.content,
        prompt: promptText,
      });
      setMessages(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], saved: true };
        return updated;
      });
      qc.invalidateQueries({ queryKey: [base, "reports"] });
      toast({ title: "Report Saved", description: "Your custom report has been saved to the Reports tab." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingIndex(null);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input;
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsStreaming(true);

    setMessages(prev => [...prev, { role: "ai", content: "", userPrompt: userMessage }]);

    try {
      const response = await fetch(`/api/accounts/${accountId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.done) {
              setIsStreaming(false);
              return;
            }
            if (json.content) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "ai") {
                  updated[updated.length - 1] = { ...last, content: last.content + json.content };
                }
                return updated;
              });
            }
          } catch {
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "ai" && last.content === "") {
          updated[updated.length - 1] = { ...last, content: "Sorry, something went wrong. Please try again." };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <Card className="flex flex-col h-[700px] shadow-sm border">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Analyst
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Ask questions about your sales data. Save any response as a report.</p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`chat-message-${i}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground text-sm"
                    : "bg-muted/60 text-foreground border"
                }`}>
                  {m.role === "ai" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2 pb-1 border-b text-foreground">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5 text-primary">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2.5 mb-1 text-foreground">{children}</h3>,
                          h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
                          hr: () => <hr className="my-3 border-border" />,
                          ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5 my-1.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5 my-1.5">{children}</ol>,
                          li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                          p: ({ children }) => <p className="text-sm leading-relaxed my-1.5">{children}</p>,
                          strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                          table: ({ children }) => <div className="overflow-x-auto my-2"><table className="min-w-full text-sm border-collapse">{children}</table></div>,
                          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                          th: ({ children }) => <th className="border px-2 py-1 text-left font-semibold text-xs">{children}</th>,
                          td: ({ children }) => <td className="border px-2 py-1 text-xs">{children}</td>,
                          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
                          code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                      {isStreaming && i === messages.length - 1 && (
                        <Loader2 className="h-4 w-4 animate-spin inline-block ml-1 mt-1" />
                      )}
                      {!isStreaming && m.content && m.content.length > 50 && i > 0 && (
                        <div className="mt-3 pt-2 border-t border-border/50">
                          <Button
                            variant={m.saved ? "ghost" : "outline"}
                            size="sm"
                            onClick={() => handleSave(i)}
                            disabled={m.saved || savingIndex === i}
                            className={m.saved ? "text-green-600" : ""}
                            data-testid={`button-save-report-${i}`}
                          >
                            {savingIndex === i ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : m.saved ? (
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                            ) : (
                              <Save className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {m.saved ? "Saved to Reports" : "Save as Report"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              placeholder="Ask for a report (e.g., 'Show me deals closing next month')"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1"
              disabled={isStreaming}
              data-testid="input-chat-message"
            />
            <Button onClick={handleSend} size="icon" disabled={isStreaming || !input.trim()} data-testid="button-send-chat">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
