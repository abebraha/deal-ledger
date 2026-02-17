import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon?: React.ElementType;
}

export function KPICard({ title, value, trend, trendUp, icon: Icon }: KPICardProps) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-display tracking-tight">{value}</div>
        {trend && (
          <p className={cn("text-xs flex items-center mt-1", trendUp ? "text-green-600" : "text-red-600")}>
            {trend}
            <span className="text-muted-foreground ml-1">vs last month</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
