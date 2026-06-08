import { NavLink, useLocation } from "react-router-dom";
import {
  Calendar,
  Users,
  Scissors,
  LayoutDashboard,
  Sparkles,
  Settings,
  BarChart3,
  UserCog,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
  useSidebar,
} from "@/components/ui/sidebar";

const baseItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Serviços", url: "/servicos", icon: Scissors },
  { title: "Agendamentos", url: "/agendamentos", icon: Calendar },
];

const adminItems = [
  { title: "Funcionários", url: "/funcionarios", icon: UserCog },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const barbeirosItems = [
  { title: "Painel Colaborador", url: "/painel-colaborador", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { funcionario, isAdmin, isBarbeiro, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  const getMenuItems = () => {
    let items = [...baseItems];

    if (isAdmin()) {
      items = [...items, ...adminItems];
    }

    if (isBarbeiro()) {
      items = [...items, ...barbeirosItems];
    }

    return items;
  };

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    `${isActive
      ? "bg-sidebar-accent/80 border border-primary/70 font-semibold shadow-violet"
      : "text-white bg-sidebar-accent/40 hover:bg-sidebar-accent/80 border border-transparent transition-smooth"
    } text-white`;

  return (
    <Sidebar className={isCollapsed ? "w-16" : "w-72"} collapsible="icon">
      <SidebarHeader className="p-4 md:p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-violet">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div>
              {/*Nome do comercio e descrição*/}
              <h2 className="font-bold text-lg text-sidebar-foreground">
                Fran Pet
              </h2>
              <p className="text-sm text-sidebar-foreground/80">
                Sistema de Gestão
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/75 font-semibold tracking-wide">
            {!isCollapsed && "Menu Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {getMenuItems().map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-12 rounded-lg px-3 text-white">
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && (
                        <span className="font-medium">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={signOut}
                  className="text-white/90 hover:text-white hover:bg-destructive/25 rounded-lg"
                >
                  <LogOut className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && <span className="font-medium">Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
