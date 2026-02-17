import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChatInterface() {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
    { role: "ai", content: "Hello Abe. I can generate custom reports on your pipeline, commitments, and team performance. What would you like to see?" }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [...prev, { role: "user", content: input }]);
    setInput("");
    
    // Mock AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "ai", 
        content: `I've analyzed the data for "${input}". Here's what I found:\n\n- Revenue is up 12% for this segment.\n- 3 commitments are overdue from the Fireflies ledger.\n- HubSpot activity shows a dip in outbound calls last week.` 
      }]);
    }, 1000);
  };

  return (
    <Card className="flex flex-col h-[600px] shadow-sm border">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Analyst
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                  m.role === "user" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-foreground"
                }`}>
                  {m.content.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? "mt-2" : ""}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input 
              placeholder="Ask for a report (e.g., 'Show me deals closing next month with overdue commitments')" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1"
            />
            <Button onClick={handleSend} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
