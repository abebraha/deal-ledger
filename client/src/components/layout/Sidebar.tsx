import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Link2, Settings, FileText, MessageSquare, Briefcase, Building2, ChevronLeft } from "lucide-react";
import { useApp } from "@/lib/context";

function navigateToRoot() {
  window.location.href = "/";
}

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/deals", label: "Deals", icon: Briefcase },
  { path: "/chat", label: "AI Reports", icon: MessageSquare },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/connections", label: "Connections", icon: Link2 },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { accountId, accountName } = useApp();
  const prefix = `/accounts/${accountId}`;

  return (
    <div className="hidden border-r bg-sidebar md:block w-64 min-h-screen text-sidebar-foreground flex flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <div className="flex items-center gap-2 font-display font-semibold text-lg">
          <div className="h-6 w-6 rounded bg-primary"></div>
          <span>DealFlow</span>
        </div>
      </div>
      <div className="border-b border-sidebar-border px-4 py-3">
        <button onClick={navigateToRoot} className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground/80 mb-1">
          <ChevronLeft className="h-3 w-3" />
          All Clients
        </button>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm truncate" data-testid="text-current-account">{accountName}</span>
        </div>
      </div>
      <div className="flex-1 py-4">
        <nav className="grid gap-1 px-2">
          {navItems.map((item) => {
            const fullPath = item.path === "/" ? prefix : `${prefix}${item.path}`;
            const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70"
                )}
                data-testid={`link-${item.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
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
