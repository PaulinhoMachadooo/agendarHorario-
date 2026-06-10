import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, LogOut, User, Scissors, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DateTimeSelector } from "@/components/DateTimeSelector";
import { HorariosFuncionamento } from "@/components/HorariosFuncionamento";

interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
  tempo_medio: number;
}

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
}

const toLocalDateTimeString = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const tzAbs = Math.abs(tz);
  const tzH = pad(Math.floor(tzAbs / 60));
  const tzM = pad(tzAbs % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${tzH}:${tzM}`;
};

interface Agendamento {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string;
  servico_id: string;
  funcionario_id: string;
  tipo_pet?: "cachorro" | "gato" | null;
  servicos: { nome: string; preco: number };
  funcionarios: { nome: string };
}

export default function PainelCliente() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [novoAgendamento, setNovoAgendamento] = useState({
    servico_id: "",
    funcionario_id: "",
    data_hora: "",
    problema_saude: "",
    acostumado_banho_tosa: "",
    restricao_banho_tosa: "",
    observacoes_adicionais: "",
    tipo_pet: "cachorro" as "cachorro" | "gato",
  });
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!cliente?.id) return;

    const channel = supabase
      .channel(`cliente-agendamentos-${cliente.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agendamentos",
          filter: `cliente_id=eq.${cliente.id}`,
        },
        () => {
          fetchAgendamentos(cliente.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cliente?.id]);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth-cliente");
      return;
    }

    // Buscar cliente, serviços e funcionários em paralelo
    const [clienteRes, servicosRes, funcionariosRes] = await Promise.all([
      supabase
        .from("clientes")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle(),
      supabase.from("servicos").select("*").order("nome"),
      supabase
        .from("funcionarios")
        .select("id, nome, cargo")
        .eq("ativo", true)
        .order("nome"),
    ]);

    if (servicosRes.data) setServicos(servicosRes.data);
    if (funcionariosRes.data) setFuncionarios(funcionariosRes.data);

    if (clienteRes.error || !clienteRes.data) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus dados",
        variant: "destructive",
      });
      navigate("/auth-cliente");
      setLoading(false);
      return;
    }

    setCliente(clienteRes.data);
    await fetchAgendamentos(clienteRes.data.id);

    setLoading(false);
  };

  const fetchCliente = async (userId: string) => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus dados",
        variant: "destructive",
      });
      navigate("/auth-cliente");
      return;
    }

    setCliente(data);
    await fetchAgendamentos(data.id);
  };

  const fetchServicos = async () => {
    const { data, error } = await supabase
      .from("servicos")
      .select("*")
      .order("nome");

    if (error) {
      console.error("Erro ao carregar serviços:", error);
      return;
    }

    setServicos(data || []);
  };

  const fetchFuncionarios = async () => {
    const { data, error } = await supabase
      .from("funcionarios")
      .select("id, nome, cargo")
      .eq("ativo", true)
      .order("nome");

    if (error) {
      console.error("Erro ao carregar funcionários:", error);
      return;
    }

    setFuncionarios(data || []);
  };

  const fetchAgendamentos = async (clienteId: string) => {
    const { data, error } = await supabase
      .from("agendamentos")
      .select(
        `
        *,
        servicos (nome, preco),
        funcionarios:funcionario_id (nome)
      `,
      )
      .eq("cliente_id", clienteId)
      .order("data_hora", { ascending: false });

    if (error) {
      console.error("Erro ao carregar agendamentos:", error);
      return;
    }

    setAgendamentos(data || []);
  };

  const handleCreateAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cliente || !selectedDate || !selectedTime) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, selecione data e horário",
        variant: "destructive",
      });
      return;
    }

    try {
      if (novoAgendamento.tipo_pet === "gato") {
        const diaSemana = selectedDate.getDay();
        const [horaG, minutoG] = selectedTime.split(":").map(Number);

        if (diaSemana !== 2 && diaSemana !== 3) {
          toast({
            title: "Data indisponível para gatos",
            description:
              "Gatos são atendidos somente às terças e quartas-feiras.",
            variant: "destructive",
          });
          return;
        }

        if (horaG * 60 + minutoG >= 12 * 60) {
          toast({
            title: "Horário indisponível para gatos",
            description: "Gatos são atendidos somente no período da manhã.",
            variant: "destructive",
          });
          return;
        }
      }

      // Combina data e hora selecionadas
      const [hora, minuto] = selectedTime.split(":").map(Number);
      const dataHora = new Date(selectedDate);
      dataHora.setHours(hora, minuto, 0, 0);

      const { error } = await supabase.from("agendamentos").insert([
        {
          cliente_id: cliente.id,
          servico_id: novoAgendamento.servico_id,
          funcionario_id: novoAgendamento.funcionario_id,
          data_hora: toLocalDateTimeString(dataHora),
          observacoes: [
            "Questionário do animal:",
            `- Problema de saúde: ${novoAgendamento.problema_saude || "Não informado"}`,
            `- Acostumado a banho e tosa: ${novoAgendamento.acostumado_banho_tosa || "Não informado"}`,
            `- Restrição com banho/tosa: ${novoAgendamento.restricao_banho_tosa || "Não informado"}`,
            `- Observações adicionais: ${novoAgendamento.observacoes_adicionais || "Não informado"}`,
          ].join("\n"),
          status: "agendado" as any,
          tipo_pet: novoAgendamento.tipo_pet,
        } as any,
      ]);

      if (error) throw error;

      toast({
        title: "Agendamento criado!",
        description: "Seu agendamento foi realizado com sucesso.",
      });

      setNovoAgendamento({
        servico_id: "",
        funcionario_id: "",
        data_hora: "",
        problema_saude: "",
        acostumado_banho_tosa: "",
        restricao_banho_tosa: "",
        observacoes_adicionais: "",
        tipo_pet: "cachorro",
      });
      setSelectedDate(undefined);
      setSelectedTime("");

      await fetchAgendamentos(cliente.id);
    } catch (error: any) {
      toast({
        title: "Erro ao criar agendamento",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelarAgendamento = async (agendamentoId: string) => {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .update({ status: "cancelado" })
        .eq("id", agendamentoId);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "Seu agendamento foi cancelado.",
      });

      if (cliente) {
        await fetchAgendamentos(cliente.id);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth-cliente");
  };

  const getServicoDados = (agendamento: Agendamento) => {
    if (agendamento.servicos?.nome || agendamento.servicos?.preco) {
      return {
        nome: agendamento.servicos?.nome || "Serviço",
        preco: Number(agendamento.servicos?.preco || 0),
      };
    }

    const servicoLocal = servicos.find((s) => s.id === agendamento.servico_id);
    return {
      nome: servicoLocal?.nome || "Serviço",
      preco: Number(servicoLocal?.preco || 0),
    };
  };
  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      agendado: "default",
      concluido: "secondary",
      cancelado: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-full p-2">
              <Scissors className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Painel do Cliente</h1>
              <p className="text-sm text-muted-foreground">{cliente?.nome}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Horário de Funcionamento */}
        <div className="mb-6">
          <HorariosFuncionamento />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Meus Dados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Meus Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-muted-foreground">Nome</Label>
                <p className="font-medium">{cliente?.nome}</p>
              </div>
              {/*<div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{cliente?.email}</p>
              </div>*/}
              <div>
                <Label className="text-muted-foreground">Telefone</Label>
                <p className="font-medium">{cliente?.telefone}</p>
              </div>
            </CardContent>
          </Card>

          {/* Novo Agendamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Novo Agendamento
              </CardTitle>
              <CardDescription>
                Agende seu próximo corte ou serviço
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAgendamento} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="servico">Serviço</Label>
                  <Select
                    value={novoAgendamento.servico_id}
                    onValueChange={(value) =>
                      setNovoAgendamento({
                        ...novoAgendamento,
                        servico_id: value,
                      })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos.map((servico) => (
                        <SelectItem key={servico.id} value={servico.id}>
                          {servico.nome} - R$ {Number(servico.preco).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="funcionario">Profissional</Label>
                  <Select
                    value={novoAgendamento.funcionario_id}
                    onValueChange={(value) =>
                      setNovoAgendamento({
                        ...novoAgendamento,
                        funcionario_id: value,
                      })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionarios.map((funcionario) => (
                        <SelectItem key={funcionario.id} value={funcionario.id}>
                          {funcionario.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo_pet">Tipo do pet</Label>
                  <Select
                    value={novoAgendamento.tipo_pet}
                    onValueChange={(value) => {
                      setNovoAgendamento({
                        ...novoAgendamento,
                        tipo_pet: value as "cachorro" | "gato",
                      });
                      setSelectedDate(undefined);
                      setSelectedTime("");
                    }}
                    required
                  >
                    <SelectTrigger id="tipo_pet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cachorro">🐶 Cachorro</SelectItem>
                      <SelectItem value="gato">🐱 Gato</SelectItem>
                    </SelectContent>
                  </Select>
                  {novoAgendamento.tipo_pet === "gato" && (
                    <p className="text-xs text-muted-foreground">
                      Atendimento para gatos: apenas terças e quartas-feiras,
                      no período da manhã.
                    </p>
                  )}
                </div>

                <DateTimeSelector
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  funcionarioId={novoAgendamento.funcionario_id}
                  servicoId={novoAgendamento.servico_id}
                  tipoPet={novoAgendamento.tipo_pet}
                  onDateChange={setSelectedDate}
                  onTimeChange={setSelectedTime}
                />

                <div className="space-y-2">
                  <Label>Observações (opcional)</Label>
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="problema_saude">
                        O animalzinho tem algum problema de saúde?
                      </Label>
                      <Select
                        value={novoAgendamento.problema_saude}
                        onValueChange={(value) =>
                          setNovoAgendamento({
                            ...novoAgendamento,
                            problema_saude: value,
                          })
                        }
                      >
                        <SelectTrigger id="problema_saude">
                          <SelectValue placeholder="Selecione uma opção" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Não informado">
                            Não informado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="acostumado_banho_tosa">
                        Já acostumado a banho e tosa?
                      </Label>
                      <Select
                        value={novoAgendamento.acostumado_banho_tosa}
                        onValueChange={(value) =>
                          setNovoAgendamento({
                            ...novoAgendamento,
                            acostumado_banho_tosa: value,
                          })
                        }
                      >
                        <SelectTrigger id="acostumado_banho_tosa">
                          <SelectValue placeholder="Selecione uma opção" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Não informado">
                            Não informado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="restricao_banho_tosa">
                        Teria alguma restrição com o banho ou a tosa?
                      </Label>
                      <Select
                        value={novoAgendamento.restricao_banho_tosa}
                        onValueChange={(value) =>
                          setNovoAgendamento({
                            ...novoAgendamento,
                            restricao_banho_tosa: value,
                          })
                        }
                      >
                        <SelectTrigger id="restricao_banho_tosa">
                          <SelectValue placeholder="Selecione uma opção" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Não informado">
                            Não informado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observacoes_adicionais">
                        Algo a mais que você queira informar?
                      </Label>
                      <Textarea
                        id="observacoes_adicionais"
                        placeholder="Ex.: comportamento, alergias, cuidados especiais..."
                        value={novoAgendamento.observacoes_adicionais}
                        onChange={(e) =>
                          setNovoAgendamento({
                            ...novoAgendamento,
                            observacoes_adicionais: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Agendar
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Meus Agendamentos */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Meus Agendamentos</CardTitle>
              <CardDescription>
                Histórico e agendamentos futuros
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agendamentos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Você ainda não tem agendamentos
                </p>
              ) : (
                <div className="space-y-4">
                  {agendamentos.map((agendamento) => {
                    const servicoDados = getServicoDados(agendamento);
                    const isCancelado = agendamento.status === "cancelado";
                    return (
                      <div
                        key={agendamento.id}
                        className={`border rounded-lg p-4 ${isCancelado ? "bg-red-50 border-red-200 opacity-80" : ""}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className={`font-semibold ${isCancelado ? "line-through text-muted-foreground" : ""}`}>
                              {servicoDados.nome}
                            </h3>
                            <Badge variant="outline" className="mt-1">
                              {agendamento.tipo_pet === "gato"
                                ? "🐱 Gato"
                                : "🐶 Cachorro"}
                            </Badge>
                            <p className="text-sm text-muted-foreground">
                              Profissional: {agendamento.funcionarios?.nome}
                            </p>
                          </div>
                          {getStatusBadge(agendamento.status)}
                        </div>
                        <Separator className="my-2" />
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Data e Hora</p>
                            <p className={`font-medium ${isCancelado ? "line-through text-muted-foreground" : ""}`}>
                              {new Date(agendamento.data_hora).toLocaleString(
                                "pt-BR",
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Valor</p>
                            <p className={`font-medium ${isCancelado ? "line-through text-muted-foreground" : ""}`}>
                              R${" "}
                              {Number(agendamento.servicos?.preco || 0).toFixed(
                                2,
                              )}
                            </p>
                          </div>
                        </div>
                        {agendamento.observacoes && (
                          <div className="mt-2">
                            <p className="text-sm text-muted-foreground">
                              Observações:
                            </p>
                            <p className="text-sm">{agendamento.observacoes}</p>
                          </div>
                        )}
                        {agendamento.status === "agendado" && (
                          <div className="mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleCancelarAgendamento(agendamento.id)
                              }
                              className="w-full"
                            >
                              Cancelar Agendamento
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
