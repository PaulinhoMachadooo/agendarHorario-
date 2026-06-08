import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Scissors, Users, UserCircle } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Se já está logado, redirecionar para o dashboard apropriado
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-primary rounded-full p-4">
              <Scissors className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>
          {/*Nome do comercio e descrição*/}
          <h1 className="text-4xl font-bold mb-2">Fran Pet</h1>
          <p className="text-xl text-muted-foreground">Banho e Tosa</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/auth-cliente")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <UserCircle className="h-8 w-8 text-primary" />
                Área do Cliente
              </CardTitle>
              <CardDescription className="text-base">
                Faça login ou cadastre-se para agendar seus serviços
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-4 text-muted-foreground">
                <li>✓ Agende seus cortes online</li>
                <li>✓ Escolha seu profissional</li>
                <li>✓ Acompanhe seu histórico</li>
              </ul>
              <Button className="w-full" size="lg">
                Entrar como Cliente
              </Button>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/auth")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Users className="h-8 w-8 text-primary" />
                Área do Funcionário
              </CardTitle>
              <CardDescription className="text-base">
                Acesso restrito para funcionários da barbearia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-4 text-muted-foreground">
                <li>✓ Gerencie agendamentos</li>
                <li>✓ Cadastre clientes</li>
                <li>✓ Controle financeiro</li>
              </ul>
              <Button className="w-full" variant="secondary" size="lg">
                Entrar como Funcionário
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Dúvidas? Entre em contato conosco
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
