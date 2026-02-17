import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Deal } from "@/lib/context";
import { format } from "date-fns";

export function DealTable({ deals }: { deals: Deal[] }) {
  const getBadgeVariant = (stage: string) => {
    switch (stage) {
      case "Closed Won": return "default";
      case "Closed Lost": return "destructive";
      case "Discovery": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deal Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead className="text-right">Close Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow key={deal.id} data-testid={`row-deal-${deal.id}`}>
              <TableCell className="font-medium">{deal.name}</TableCell>
              <TableCell>{deal.companyName ?? "—"}</TableCell>
              <TableCell>${(deal.amount ?? 0).toLocaleString()}</TableCell>
              <TableCell>
                <Badge variant={getBadgeVariant(deal.stage) as any}>{deal.stage}</Badge>
              </TableCell>
              <TableCell>{deal.probability ?? 0}%</TableCell>
              <TableCell className="text-right">
                {deal.closeDate ? format(new Date(deal.closeDate), "MMM d, yyyy") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
