import { LayoutDashboard, Workflow, Zap, BarChart3, Phone, Settings, HelpCircle, MoreHorizontal } from "lucide-react"
import { NavLink } from "react-router-dom"

export default function Sidebar() {
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Workflow, label: "Workflows", path: "/workflows" },
    { icon: Zap, label: "Integrations", path: "/integrations" },
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
    { icon: Phone, label: "Call Logs", path: "/call-logs" },
  ]

  return (
    <div className="w-60 bg-background border-r border-border flex flex-col">
      {/* Logo */}
      <div className="h-20 px-6 flex items-center border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-bold">V</div>
          <span className="font-semibold text-text-primary">Voice Agent</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-black text-white border-l-4 border-black"
                  : "text-text-secondary hover:bg-background-secondary hover:text-text-primary"
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-border space-y-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-black text-white"
                : "text-text-secondary hover:bg-background-secondary hover:text-text-primary"
            }`
          }
        >
          <Settings className="w-4 h-4" />
          Settings
        </NavLink>
        <button className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-background-secondary hover:text-text-primary transition-colors">
          <HelpCircle className="w-4 h-4" />
          Get Help
        </button>
        <div className="px-4 py-3 rounded-lg bg-background-secondary border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">John Doe</p>
              <p className="text-xs text-text-secondary truncate">john@example.com</p>
            </div>
            <button className="p-1 hover:bg-background rounded">
              <MoreHorizontal className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}









