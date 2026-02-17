import { Sidebar } from "./Sidebar";
import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-7xl p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
