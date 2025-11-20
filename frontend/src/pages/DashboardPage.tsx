import { MainLayout } from "@/components/layout/MainLayout";
import { Users, Phone, Clock, ArrowUpRight, ArrowDownRight, MoreHorizontal } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";

const data = [
  { name: "Mon", calls: 400, success: 380 },
  { name: "Tue", calls: 300, success: 290 },
  { name: "Wed", calls: 550, success: 500 },
  { name: "Thu", calls: 450, success: 410 },
  { name: "Fri", calls: 700, success: 650 },
  { name: "Sat", calls: 200, success: 190 },
  { name: "Sun", calls: 150, success: 140 },
];

export default function DashboardPage() {
  return (
    <MainLayout 
      title="Dashboard" 
      subtitle="Welcome back, John! Here's what's happening today."
      actions={
        <Button className="bg-foreground text-background hover:bg-foreground/90 shadow-none h-9 text-sm font-medium">
          Download Report
        </Button>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* Stats Grid - Reference 2 Style: Clean cards, clear typography */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: "Total Calls", value: "12,345", change: "+12.5%", icon: Phone, trend: "up", sub: "vs last month" },
            { title: "Active Agents", value: "8", change: "+2", icon: Users, trend: "up", sub: "new agents" },
            { title: "Avg. Duration", value: "2m 45s", change: "-5.2%", icon: Clock, trend: "down", sub: "optimization" },
          ].map((stat, i) => (
            <div key={i} className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6 flex flex-col justify-between h-full bg-white dark:bg-card">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-secondary rounded-lg text-foreground">
                  <stat.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground -mr-2 -mt-2">
                  <MoreHorizontal size={16} />
                </Button>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</h3>
                <div className="text-3xl font-semibold font-heading text-foreground tracking-tight">{stat.value}</div>
                <div className="flex items-center mt-2 gap-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center ${
                    stat.trend === 'up' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    {stat.trend === 'up' ? <ArrowUpRight size={12} className="mr-1"/> : <ArrowDownRight size={12} className="mr-1"/>}
                    {stat.change}
                  </span>
                  <span className="text-xs text-muted-foreground">{stat.sub}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart - Clean, airy, minimal grid lines */}
          <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm lg:col-span-2 p-6 bg-white dark:bg-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                 <h3 className="font-semibold text-lg font-heading">Call Volume Trends</h3>
                 <p className="text-sm text-muted-foreground">Inbound vs. Successful resolutions</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs shadow-none">Weekly</Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">Monthly</Button>
              </div>
            </div>
            
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={10}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value: number) => `${value}`} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))", 
                      borderColor: "hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))", fontSize: "12px", fontWeight: "500" }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: "4px" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorCalls)" 
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="success" 
                    stroke="hsl(142, 76%, 36%)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorSuccess)" 
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Activity - List Style like Reference 1/2 */}
          <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6 bg-white dark:bg-card flex flex-col">
             <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg font-heading">Recent Activity</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={16}/></Button>
            </div>
            
            <div className="space-y-0 flex-1">
              {[
                { text: "New workflow 'Support Bot' published", time: "2 mins ago", type: "workflow" },
                { text: "Integration with Salesforce connected", time: "1 hour ago", type: "integration" },
                { text: "Alert: High latency in EU-West region", time: "3 hours ago", type: "alert" },
                { text: "Agent 'Sales Lead' updated", time: "5 hours ago", type: "agent" },
                { text: "Billing method updated", time: "1 day ago", type: "billing" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 p-3 hover:bg-muted/50 rounded-lg transition-colors group cursor-pointer">
                  <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    item.type === 'alert' ? 'bg-red-500' : 
                    item.type === 'integration' ? 'bg-green-500' : 
                    'bg-primary'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-snug group-hover:text-primary transition-colors">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 shadow-none">View All Activity</Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
