import React, { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useProject } from "@/store/project";
import { useAuth } from "@/store/auth"; // Importar do store
import {
  FolderOpen,
  Home,
  Grid3X3,
  MapPin,
  Zap,
  Boxes,
  GitBranch,
  KeySquare,
  Server,
  Eye,
  Users as UsersIcon,
  LogOut,
  Clapperboard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ModeToggle } from "@/components/ModeToggle";

const createPageUrl = (page: string) => "/" + page.toLowerCase();

interface LayoutProps {
  children: React.ReactNode;
}

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresProject?: boolean;
};

const baseItems: NavItem[] = [
  { title: "Dashboard", url: createPageUrl(""), icon: Home, requiresProject: false },
  { title: "Áreas", url: createPageUrl("areas"), icon: MapPin, requiresProject: true },
  { title: "Ambientes", url: createPageUrl("ambientes"), icon: Grid3X3, requiresProject: true },
  { title: "Quadros", url: createPageUrl("quadros"), icon: Server, requiresProject: true },
  { title: "Circuitos", url: createPageUrl("circuitos"), icon: Zap, requiresProject: true },
  { title: "Módulos", url: createPageUrl("modulos"), icon: Boxes, requiresProject: true },
  { title: "Vinculação", url: createPageUrl("vinculacao"), icon: GitBranch, requiresProject: true },
  { title: "Keypads", url: createPageUrl("keypads"), icon: KeySquare, requiresProject: true },
  { title: "Cenas", url: createPageUrl("cenas"), icon: Clapperboard, requiresProject: true },
  { title: "Visualizar Projeto", url: createPageUrl("projeto"), icon: Eye, requiresProject: true },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { projeto, loading: projectLoading } = useProject();
  const { user: sessionUser, loading: sessionLoading, logout } = useAuth();

  const projectSelected = !!projeto?.id;

  const isAdmin = sessionUser?.role === "admin";

  const navigationItems = useMemo<NavItem[]>(() => {
    if (!isAdmin) return baseItems;
    return [
      ...baseItems,
      { title: "Usuários", url: createPageUrl("usuarios"), icon: UsersIcon, requiresProject: false },
    ];
  }, [isAdmin]);

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      toast({ title: "Sessão encerrada" });
    } catch {
      // segue pro login mesmo assim
    } finally {
      setLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <Sidebar className="border-r border-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="border-b border-border p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                  <FolderOpen className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-foreground">Roehn</h2>
                  <p className="text-xs text-muted-foreground font-medium">Gerenciador de Projetos</p>
                </div>
              </div>
              <ModeToggle />
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">
                Navegação
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {navigationItems.map((item) => {
                    const active =
                      location.pathname === item.url ||
                      location.pathname.startsWith(item.url + "/");

                    const isLoading = projectLoading || sessionLoading;
                    const disableByProject =
                      item.requiresProject && (isLoading || !projectSelected);
                    const classNames = [
                      "transition-all duration-200 rounded-xl h-11",
                      "hover:bg-muted hover:text-foreground",
                      active
                        ? "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                        : "text-muted-foreground",
                      disableByProject ? "opacity-60" : "",
                    ].join(" ");

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild className={classNames}>
                          <Link
                            to={item.url}
                            onClick={(e) => {
                              if (disableByProject) {
                                e.preventDefault();
                                toast({
                                  title: "Selecione um projeto",
                                  description: "Algumas seções exigem um projeto ativo.",
                                });
                                navigate("/", { replace: false });
                              }
                            }}
                            className="flex items-center gap-3 px-4"
                          >
                            <item.icon className="w-4 h-4" />
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-border p-4">
            <div className="flex items-center gap-3 px-2 mb-3">
              <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center">
                <span className="text-muted-foreground font-semibold text-sm">
                  {sessionLoading ? "" : sessionUser?.username?.charAt(0)?.toUpperCase() || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate text-foreground">
                  {sessionLoading ? "Carregando..." : sessionUser?.username || "Usuário"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {sessionLoading ? "" : (sessionUser?.role ? `Função: ${sessionUser.role}` : "Gerenciar projetos")}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center rounded-xl border-border text-foreground"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {loggingOut ? "Saindo..." : "Sair"}
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col bg-background">
          <header className="bg-card/90 backdrop-blur-sm border-b border-border px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-muted p-2 rounded-xl transition-colors duration-200" />
              <h1 className="text-xl font-bold text-foreground">Roehn</h1>
              <ModeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={handleLogout}
                disabled={loggingOut}
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-auto">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
