import { 
  LayoutGrid, 
  GitBranch, 
  Blocks, 
  Phone, 
  PieChart, 
  Settings, 
  LogOut,
  ChevronsUpDown,
  Sparkles,
  Command,
  Sun,
  Moon,
  Laptop,
  LifeBuoy
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";

export function AppSidebar() {
  const { setTheme, theme } = useTheme();

  // Using icons closer to Reference 1 (cleaner, more geometric)
  const navItems = [
    { icon: LayoutGrid, label: "Dashboard", href: "/" },
    { icon: GitBranch, label: "Workflows", href: "/workflows" },
    { icon: Blocks, label: "Integrations", href: "/integrations" },
    { icon: Phone, label: "Call Logs", href: "/call-logs" },
    { icon: PieChart, label: "Analytics", href: "/analytics" },
  ];

  const settingsItems = [
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: LifeBuoy, label: "Help & Support", href: "/support" },
  ];

  return (
    <aside className="w-[260px] h-screen bg-sidebar flex flex-col sticky top-0 transition-colors duration-300 font-heading border-r border-border/60 sidebar">
      {/* Header / Workspace Switcher - Clean Black/Gray */}
      <div className="p-4 pb-2 pt-6">
        {/* Workspace Dropdown Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors group border border-transparent hover:border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center text-background shadow-sm">
                  <Sparkles size={14} strokeWidth={2.5} />
                </div>
                <span className="font-medium text-sm text-sidebar-foreground group-hover:text-sidebar-primary transition-colors">Pro Workspace</span>
              </div>
              <ChevronsUpDown size={14} className="text-sidebar-foreground/40 group-hover:text-sidebar-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[220px] ml-2" align="start">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Switch Workspace</DropdownMenuLabel>
            <DropdownMenuItem className="gap-2 font-medium">
              <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground">
                <Sparkles className="size-3" />
              </div>
              Pro Workspace
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 font-medium text-muted-foreground">
              <div className="flex size-6 items-center justify-center rounded border bg-background text-muted-foreground">
                <Command className="size-3" />
              </div>
              Acme Corp.
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-primary cursor-pointer">
               <div className="flex size-6 items-center justify-center rounded border border-dashed border-primary/30 bg-primary/5 text-primary">
                  <span className="text-xs font-bold">+</span>
               </div>
               Create Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Navigation - Monochrome Active States */}
      <nav className="flex-1 px-4 space-y-1 mt-6">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-heading font-normal transition-all duration-200 group relative",
              isActive 
                ? "text-sidebar-primary bg-sidebar-accent/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-sidebar-foreground hover:text-sidebar-primary hover:bg-sidebar-accent/40"
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} strokeWidth={isActive ? 2 : 1.5} className={cn(
                  "transition-colors",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-primary"
                )} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}

        <div className="pt-8 pb-2">
          <p className="px-4 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">System</p>
          {settingsItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-heading font-normal transition-all duration-200 group",
                  isActive
                    ? "text-sidebar-primary bg-sidebar-accent/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-sidebar-foreground hover:text-sidebar-primary hover:bg-sidebar-accent/40",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={20}
                    strokeWidth={isActive ? 2 : 1.5}
                    className={cn(
                      "transition-colors",
                      isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-primary",
                    )}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 mt-auto">
        <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-sidebar-accent/50 border border-border/50 mb-4">
           <span className="text-xs font-medium text-muted-foreground pl-2">Theme</span>
           <div className="flex bg-background rounded-md p-0.5 border border-border shadow-sm">
              <button 
                onClick={() => setTheme('light')} 
                className={cn("p-1.5 rounded transition-all", theme === 'light' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                <Sun size={14} />
              </button>
              <button 
                onClick={() => setTheme('system')} 
                className={cn("p-1.5 rounded transition-all", theme === 'system' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                <Laptop size={14} />
              </button>
              <button 
                onClick={() => setTheme('dark')} 
                className={cn("p-1.5 rounded transition-all", theme === 'dark' ? 'bg-sidebar-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                <Moon size={14} />
              </button>
           </div>
        </div>

        <div className="flex items-center gap-3 px-2 py-2">
          <div className="relative">
            <Avatar className="w-9 h-9 border border-border">
              <AvatarFallback className="bg-neutral-200 dark:bg-neutral-800 text-xs font-semibold">JD</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-sidebar rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">John Doe</p>
            <p className="text-xs text-muted-foreground truncate">Admin</p>
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
