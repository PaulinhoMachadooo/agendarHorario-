import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <main className="flex-1 flex flex-col">
          <header className="h-16 border-b border-sidebar-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
            <div className="h-full px-6 flex items-center justify-between">
              <SidebarTrigger className="transition-smooth hover:bg-primary/10 hover:text-primary rounded-md p-2" />

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">Admin</p>
                  {/*Nome do comercio e descrição*/}
                  <p className="text-xs text-muted-foreground">Fran Pet</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center shadow-violet">
                  <span className="text-sm font-bold text-white">A</span>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 p-3 md:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
