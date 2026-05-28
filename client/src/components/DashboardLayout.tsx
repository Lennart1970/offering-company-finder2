import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { List, LogOut, PanelLeft, BrainCircuit, FileSpreadsheet, Phone, ScrollText, Network, Camera, Package, Globe, LayoutList, RefreshCw, Zap, Webhook, UserPlus, BookMarked, Eye, FolderOpen, MapPin, Building2, Users, Activity, ChevronDown, Crosshair, Share2 } from "lucide-react";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  superAdminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: "Intelligence",
    items: [
      { icon: BrainCircuit, label: "Business Unit", path: "/brain" },
      { icon: List, label: "Search Results", path: "/search-results" },
      { icon: Zap, label: "Intelligence", path: "/intelligence" },
      { icon: Share2, label: "Shared Lists", path: "/share-lists" },
      { icon: Network, label: "Market Segments", path: "/niche-review" },
    ],
  },
  {
    label: "Import / Sync",
    items: [
      { icon: FileSpreadsheet, label: "Excel Import", path: "/excel-import" },
      { icon: Globe, label: "Leadinfo Import", path: "/leadinfo" },
      { icon: RefreshCw, label: "Sync", path: "/sync" },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      { icon: ScrollText, label: "Prompt Repository", path: "/prompts" },
      { icon: Webhook, label: "Webhook Log", path: "/webhook-log" },
      { icon: Eye, label: "Business Unit Visibility", path: "/brain-visibility", superAdminOnly: true },
      { icon: FolderOpen, label: "Sales Materials", path: "/sales-materials" },
      { icon: Activity, label: "Access Log", path: "/share-access-log" },
    ],
  },
  {
    label: "Under Development",
    adminOnly: true,
    items: [
      { icon: Phone, label: "Call Today", path: "/call-today" },
      { icon: BookMarked, label: "Nurture List", path: "/nurture" },
      { icon: LayoutList, label: "Sales Menu", path: "/sales-menu" },
      { icon: Crosshair, label: "Campaign from Business Unit", path: "/campaign-from-brain" },
      { icon: Zap, label: "Trigger Review", path: "/trigger-review" },
      { icon: MapPin, label: "CG Market", path: "/cg-market" },
      { icon: Building2, label: "CG Sites", path: "/cg-sites" },
      { icon: Users, label: "CG Team", path: "/cg-team" },
      { icon: Camera, label: "Fast Prototype", path: "/fast-prototype" },
      { icon: Package, label: "Prototype Requests", path: "/prototype-requests" },
    ],
  },
  {
    label: "Legal",
    adminOnly: true,
    items: [
      { icon: ScrollText, label: "Terms of Use", path: "/terms" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const COLLAPSED_GROUPS_KEY = "sidebar-collapsed-groups";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function getInitialCollapsedGroups(): Set<string> {
  try {
    const saved = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch { /* ignore */ }
  return new Set();
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-6xl font-black tracking-tight text-center">[CF]</h1>
            <p className="text-lg font-bold text-center max-w-sm">
              COMPANY FINDER COCKPIT
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Sign in to access offering extraction, company search, and deep research tools.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full font-black text-lg py-6 border-4 border-black"
          >
            SIGN IN
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function NavGroupBlock({
  group,
  location,
  handleNavClick,
  collapsed,
  onToggle,
  isAdminGroup,
  isSuperAdmin,
}: {
  group: NavGroup;
  location: string;
  handleNavClick: (path: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  isAdminGroup?: boolean;
  isSuperAdmin?: boolean;
}) {
  return (
    <SidebarGroup className="pt-1.5 pb-0">
      <SidebarGroupLabel
        className="px-3 mb-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 group-data-[collapsible=icon]:hidden cursor-pointer select-none flex items-center justify-between hover:text-muted-foreground/90 transition-colors"
        onClick={onToggle}
      >
        <span className={isAdminGroup ? "text-amber-600/80" : ""}>{group.label}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
        />
      </SidebarGroupLabel>
      {!collapsed && (
        <SidebarGroupContent>
          <SidebarMenu className="px-1.5">
            {group.items.filter((item: NavItem) => !item.superAdminOnly || isSuperAdmin).map((item: NavItem) => {
              const isActive =
                item.path === "/search-results"
                  ? location.startsWith("/search-results")
                  : item.path === "/call-today"
                  ? location.startsWith("/call-today")
                  : location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => handleNavClick(item.path)}
                    tooltip={item.label}
                    className="h-7 text-xs transition-all font-semibold"
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  // Collapsible group state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(getInitialCollapsedGroups);

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  // Match active menu item - handle parameterized routes
  const allNavItems = navGroups.flatMap(g => g.items);
  const activeMenuItem = allNavItems.find((item: NavItem) => {
    if (item.path === "/search-results") {
      return location.startsWith("/search-results");
    }
    if (item.path === "/call-today") {
      return location.startsWith("/call-today");
    }
    return location === item.path;
  });

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handleNavClick = (path: string) => {
    // For Search Results, go to the listing page (no specific search)
    if (path === "/search-results") {
      setLocation("/search-results/select");
      return;
    }
    // For Call Today, navigate directly (cross-campaign queue, no search required)
    if (path === "/call-today") {
      const match = location.match(/\/search-results\/(\d+)/);
      if (match) {
        // If already on a search, open the scoped Call Today for that search
        setLocation(`/call-today/${match[1]}`);
      } else {
        // Otherwise go to the global cross-campaign Call Today queue
        setLocation("/call-today");
      }
      return;
    }
    setLocation(path);
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-12 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-black tracking-tight truncate text-lg">[CF]</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* ── User section ── */}
            {navGroups.filter(g => !g.adminOnly).map(group => (
              <NavGroupBlock
                key={group.label}
                group={group}
                location={location}
                handleNavClick={handleNavClick}
                collapsed={collapsedGroups.has(group.label)}
                onToggle={() => toggleGroup(group.label)}
                isSuperAdmin={isSuperAdmin}
              />
            ))}

            {/* ── Admin section (admins only) ── */}
            {isAdmin && (
              <>
                <div className="mx-3 my-2 border-t border-dashed border-amber-600/30 group-data-[collapsible=icon]:hidden" />
                {navGroups.filter(g => g.adminOnly).map(group => (
                  <NavGroupBlock
                    key={group.label}
                    group={group}
                    location={location}
                    handleNavClick={handleNavClick}
                    collapsed={collapsedGroups.has(group.label)}
                    onToggle={() => toggleGroup(group.label)}
                    isAdminGroup
                    isSuperAdmin={isSuperAdmin}
                  />
                ))}
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-7 w-7 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-bold truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user?.role === "admin" && (
                  <DropdownMenuItem
                    onClick={() => {
                      const url = window.location.origin;
                      navigator.clipboard.writeText(url).then(() => {
                        // Show a quick visual feedback
                        const el = document.createElement("div");
                        el.textContent = "Invite link copied!";
                        el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:8px 20px;font-weight:900;font-size:12px;z-index:9999;letter-spacing:0.1em;";
                        document.body.appendChild(el);
                        setTimeout(() => document.body.removeChild(el), 2000);
                      });
                    }}
                    className="cursor-pointer"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Copy invite link</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground font-bold">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
