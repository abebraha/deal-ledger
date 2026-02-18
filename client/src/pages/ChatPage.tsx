import { Layout } from "@/components/layout/Layout";
import { ChatInterface } from "@/pages/Chat";

export function ChatPage() {
  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">AI Reporting Analyst</h1>
          <p className="text-muted-foreground mt-2">Ask questions about your pipeline, activities, and team performance.</p>
        </div>
        <ChatInterface />
      </div>
    </Layout>
  );
}
