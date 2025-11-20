import { MainLayout } from "@/components/layout/MainLayout";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

const callVolumeData = [
  { time: "00:00", calls: 12 },
  { time: "04:00", calls: 5 },
  { time: "08:00", calls: 45 },
  { time: "12:00", calls: 120 },
  { time: "16:00", calls: 90 },
  { time: "20:00", calls: 35 },
  { time: "23:59", calls: 15 },
];

const sentimentData = [
  { name: "Positive", value: 65, color: "hsl(142, 76%, 36%)" },
  { name: "Neutral", value: 25, color: "hsl(217, 33%, 50%)" },
  { name: "Negative", value: 10, color: "hsl(346, 87%, 43%)" },
];

const intentData = [
  { name: "Sales Inquiry", count: 450 },
  { name: "Support", count: 320 },
  { name: "Billing", count: 150 },
  { name: "Technical", count: 210 },
  { name: "Other", count: 80 },
];

export default function AnalyticsPage() {
  return (
    <MainLayout title="Analytics" subtitle="Deep dive into your agent performance data.">
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6 bg-white dark:bg-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-semibold text-lg">Call Volume (24h)</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreHorizontal size={16}/></Button>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={callVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                  <XAxis 
                    dataKey="time" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))", 
                      borderColor: "hsl(var(--border))", 
                      borderRadius: "var(--radius)",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))", fontSize: "12px", fontWeight: "500" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2} 
                    dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 0 }} 
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6 bg-white dark:bg-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-semibold text-lg">User Sentiment</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreHorizontal size={16}/></Button>
            </div>
            <div className="flex justify-center">
              <div className="h-[300px] w-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))", 
                        borderColor: "hsl(var(--border))", 
                        borderRadius: "var(--radius)",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                      }}
                      itemStyle={{ color: "hsl(var(--foreground))", fontSize: "12px", fontWeight: "500" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm lg:col-span-2 p-6 bg-white dark:bg-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-semibold text-lg">Call Intents</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreHorizontal size={16}/></Button>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    cursor={{fill: 'hsl(var(--secondary))', opacity: 0.4}}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))", 
                      borderColor: "hsl(var(--border))", 
                      borderRadius: "var(--radius)",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))", fontSize: "12px", fontWeight: "500" }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
