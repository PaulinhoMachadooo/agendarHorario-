import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCliente() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ telefone: "" });
  const [signupData, setSignupData] = useState({
    nome: "",
    telefone: "",
  });

  const normalizePhone = (value: string) => value.replace(/\D/g, "");
  const getClienteEmail = (telefone: string) => `${normalizePhone(telefone)}@cliente.barbearia.com`;
  const createClientePassword = () =>
    `cliente-sem-senha-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkUserType(session.user.id);
      }
    });
  }, []);

  const checkUserType = async (userId: string) => {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (cliente) {
      navigate("/painel-cliente");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const telefoneNormalizado = normalizePhone(loginData.telefone);

      if (!telefoneNormalizado) {
        throw new Error("Informe um telefone válido");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: getClienteEmail(telefoneNormalizado),
        password: "",
      });

      if (error) throw error;

      if (data.user) {
        const { data: cliente, error: clienteError } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (clienteError) throw clienteError;

        if (!cliente) {
          const { error: createClienteError } = await supabase.from("clientes").insert([
            {
              user_id: data.user.id,
              nome: data.user.user_metadata?.nome || "Cliente",
              email: data.user.email || getClienteEmail(telefoneNormalizado),
              telefone: telefoneNormalizado,
            },
          ]);

          if (createClienteError && !createClienteError.message.toLowerCase().includes("duplicate")) {
            throw createClienteError;
          }
        }

        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta!",
        });
        navigate("/painel-cliente");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const nome = signupData.nome.trim();
    const cleanPhone = normalizePhone(signupData.telefone);

    if (!nome) {
      toast({
        title: "Erro",
        description: "Informe o nome do cliente",
        variant: "destructive",
      });
      return;
    }

    if (cleanPhone.length < 10) {
      toast({
        title: "Erro",
        description: "Informe um telefone válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const generatedEmail = getClienteEmail(cleanPhone);
      const redirectUrl = `${window.location.origin}/painel-cliente`;

      const { data, error } = await supabase.auth.signUp({
        email: generatedEmail,
        password: createClientePassword(),
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            tipo_usuario: "cliente",
            user_type: "cliente",
            nome,
            telefone: cleanPhone,
          },
        },
      });

      if (error) throw error;

      if (data.user && data.session) {
        try {
          const { error: clienteError } = await supabase.from("clientes").insert([
            {
              user_id: data.user.id,
              nome,
              email: generatedEmail,
              telefone: cleanPhone,
            },
          ]);

          if (clienteError && !clienteError.message.includes("duplicate")) {
            console.error("Erro ao criar cliente:", clienteError);
          }
        } catch (insertError) {
          console.error("Erro na inserção:", insertError);
        }

        toast({
          title: "Cadastro realizado!",
          description: "Bem-vindo à nossa barbearia!",
        });
        navigate("/painel-cliente");
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Confira seu email para confirmar a conta antes de fazer login.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary rounded-full p-3">
              <Scissors className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Área do Cliente</CardTitle>
          <CardDescription>
            Entre com seu telefone ou cadastre-se para agendar seus serviços
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-telefone">Telefone</Label>
                  <Input
                    id="login-telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={loginData.telefone}
                    onChange={(e) => setLoginData({ ...loginData, telefone: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-nome">Nome Completo</Label>
                  <Input
                    id="signup-nome"
                    type="text"
                    placeholder="Seu nome"
                    value={signupData.nome}
                    onChange={(e) => setSignupData({ ...signupData, nome: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-telefone">Telefone</Label>
                  <Input
                    id="signup-telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={signupData.telefone}
                    onChange={(e) => setSignupData({ ...signupData, telefone: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Cadastrando..." : "Cadastrar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
