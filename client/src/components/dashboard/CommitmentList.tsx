import { ScrollArea } from "@/components/ui/scroll-area";
import { Commitment } from "@/lib/context";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function CommitmentList({ commitments }: { commitments: Commitment[] }) {
  return (
    <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-card">
      <div className="space-y-4">
        {commitments.map((item) => (
          <div key={item.id} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
            {item.status === "Completed" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : item.status === "Overdue" ? (
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">{item.commitment}</p>
              <div className="flex items-center text-xs text-muted-foreground gap-2">
                <span className="font-medium">{item.meetingTitle}</span>
                <span>•</span>
                <span>Due {item.dueDate ? format(new Date(item.dueDate), "MMM d") : "No Date"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
