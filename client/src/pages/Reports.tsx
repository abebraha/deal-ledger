import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Mail } from "lucide-react";

export function Reports() {
  const reports = [
    { id: 1, title: "Weekly Pipeline Update", date: "Oct 28, 2024", type: "Weekly", status: "Sent" },
    { id: 2, title: "Bi-Weekly CEO Scorecard", date: "Oct 22, 2024", type: "Bi-Weekly", status: "Sent" },
    { id: 3, title: "Weekly Pipeline Update", date: "Oct 21, 2024", type: "Weekly", status: "Sent" },
    { id: 4, title: "Weekly Pipeline Update", date: "Oct 14, 2024", type: "Weekly", status: "Sent" },
    { id: 5, title: "Bi-Weekly CEO Scorecard", date: "Oct 08, 2024", type: "Bi-Weekly", status: "Sent" },
  ];

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">Reports Archive</h1>
            <p className="text-muted-foreground mt-2">View past AI-generated reports and scorecards.</p>
          </div>
          <Button>Generate New Report</Button>
        </div>

        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="flex flex-row items-center justify-between p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{report.title}</h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{report.date}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs">{report.type}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
