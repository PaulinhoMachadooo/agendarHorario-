import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, funcionario, loading, signOut, session, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Se há usuário mas não há funcionário registrado E não é admin via metadata, mostrar mensagem de erro
  if (user && !funcionario && !session?.user?.user_metadata?.nivel_acesso) {
    const handleSignOut = async () => {
      await signOut();
      window.location.href = '/auth';
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-md p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Usuário não cadastrado como funcionário. Entre em contato com o administrador.
            </p>
          </div>
          <div className="space-y-3">
            <Button 
              onClick={handleSignOut}
              className="w-full"
              variant="default"
            >
              Fazer Logout e Voltar ao Login
            </Button>
            <Button 
              onClick={() => window.location.href = '/agendamento-publico'}
              className="w-full"
              variant="outline"
            >
              Ir para Agendamento Público
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Se requer admin mas o usuário não é admin, redirecionar para dashboard
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}