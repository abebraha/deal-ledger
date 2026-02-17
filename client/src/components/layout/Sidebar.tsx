import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Link2, Settings, FileText, MessageSquare, Briefcase } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/deals", label: "Deals", icon: Briefcase },
  { href: "/chat", label: "AI Reports", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="hidden border-r bg-sidebar md:block w-64 min-h-screen text-sidebar-foreground flex flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <div className="flex items-center gap-2 font-display font-semibold text-lg">
          <div className="h-6 w-6 rounded bg-primary"></div>
          <span>DealFlow</span>
        </div>
      </div>
      <div className="flex-1 py-4">
        <nav className="grid gap-1 px-2">
          {items.map((item) => (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  location === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-xs font-bold">AL</span>
          </div>
          <div className="text-sm">
            <div className="font-medium">Abe Lincoln</div>
            <div className="text-xs text-sidebar-foreground/60">CEO</div>
          </div>
        </div>
      </div>
    </div>
  );
}
