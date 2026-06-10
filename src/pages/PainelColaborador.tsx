import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  DollarSign,
  Scissors,
  TrendingUp,
  User,
  Home,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  startOfMonth,
  endOfMonth,
  isToday,
  isTomorrow,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface AgendamentoColaborador {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string;
  tipo_pet?: "cachorro" | "gato" | null;
  cliente_id: string;
  servico_id: string;
  clientes: {
    nome: string;
    telefone: string;
  };
  servicos: {
    nome: string;
    preco: number;
    tempo_medio: number;
  };
}

interface TransacaoColaborador {
  id: string;
  valor_servico: number;
  valor_comissao: number;
  created_at: string;
  agendamentos: {
    data_hora: string;
    servicos: {
      nome: string;
    };
  };
}

interface EstatisticasColaborador {
  agendamentosHoje: number;
  agendamentosAmanha: number;
  servicosConcluidosMes: number;
  ganhosMes: number;
}

const QUESTIONARIO_PREFIX = "Questionário do animal:";

const parseQuestionarioAnimal = (observacoes?: string | null) => {
  if (!observacoes || !observacoes.startsWith(QUESTIONARIO_PREFIX)) {
    return null;
  }

  const linhas = observacoes
    .split("\n")
    .slice(1)
    .map((linha) => linha.trim());

  const getResposta = (prefixo: string) =>
    linhas.find((linha) => linha.startsWith(prefixo))?.replace(prefixo, "").trim() ||
    "Não informado";

  return {
    problemaSaude: getResposta("- Problema de saúde: "),
    acostumadoBanhoTosa: getResposta("- Acostumado a banho e tosa: "),
    restricaoBanhoTosa: getResposta("- Restrição com banho/tosa: "),
    observacoesAdicionais: getResposta("- Observações adicionais: "),
  };
};

export default function PainelColaborador() {
  const { user, funcionario } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [agendamentos, setAgendamentos] = useState<AgendamentoColaborador[]>(
    [],
  );
  const [transacoes, setTransacoes] = useState<TransacaoColaborador[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasColaborador>({
    agendamentosHoje: 0,
    agendamentosAmanha: 0,
    servicosConcluidosMes: 0,
    ganhosMes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (funcionario) {
      fetchDados();
    }
  }, [funcionario]);

  useEffect(() => {
    if (!funcionario?.id) return;

    const channel = supabase
      .channel(`colaborador-agendamentos-${funcionario.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agendamentos",
          filter: `funcionario_id=eq.${funcionario.id}`,
        },
        () => {
          fetchDados();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [funcionario?.id]);

  const fetchDados = async () => {
    if (!funcionario) return;

    try {
      const hoje = new Date();
      const inicioMes = startOfMonth(hoje);
      const fimMes = endOfMonth(hoje);
      const fimMesExclusivo = new Date(fimMes);
      fimMesExclusivo.setDate(fimMesExclusivo.getDate() + 1);

      // Buscar agendamentos e transações em paralelo
      const [agendamentosRes, transacoesRes] = await Promise.all([
        supabase
          .from("agendamentos")
          .select(
            `*, clientes(nome, telefone), servicos(nome, preco, tempo_medio)`,
          )
          .eq("funcionario_id", funcionario.id)
          .gte("data_hora", format(hoje, "yyyy-MM-dd"))
          .order("data_hora", { ascending: true }),
        supabase
          .from("transacoes_financeiras")
          .select(`*, agendamentos(data_hora, servicos(nome))`)
          .eq("funcionario_id", funcionario.id)
          .gte("created_at", format(inicioMes, "yyyy-MM-dd"))
          .lt("created_at", format(fimMesExclusivo, "yyyy-MM-dd"))
          .order("created_at", { ascending: false }),
      ]);

      if (agendamentosRes.error) throw agendamentosRes.error;
      if (transacoesRes.error) throw transacoesRes.error;

      const agendamentosData = agendamentosRes.data;
      const transacoesData = transacoesRes.data;

      setAgendamentos(agendamentosData || []);
      setTransacoes((transacoesData as any) || []);

      // Calcular estatísticas
      const agendamentosHoje =
        agendamentosData?.filter((a) => isToday(new Date(a.data_hora)))
          .length || 0;

      const agendamentosAmanha =
        agendamentosData?.filter((a) => isTomorrow(new Date(a.data_hora)))
          .length || 0;

      const servicosConcluidosMes = transacoesData?.length || 0;
      const ganhosMes =
        transacoesData?.reduce((sum, t: any) => sum + Number(t.valor_comissao ?? t.valor ?? 0), 0) ||
        0;

      setEstatisticas({
        agendamentosHoje,
        agendamentosAmanha,
        servicosConcluidosMes,
        ganhosMes,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      agendado: { label: "Agendado", variant: "default" as const },
      confirmado: { label: "Confirmado", variant: "secondary" as const },
      concluido: { label: "Concluído", variant: "default" as const },
      cancelado: { label: "Cancelado", variant: "destructive" as const },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || {
      label: status,
      variant: "outline" as const,
    };

    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatDataHora = (dataHora: string) => {
    const data = new Date(dataHora);
    return {
      data: format(data, "dd/MM/yyyy", { locale: ptBR }),
      hora: format(data, "HH:mm"),
      diaSemana: format(data, "EEEE", { locale: ptBR }),
    };
  };

  const getTipoPetInfo = (tipoPet?: string | null) =>
    tipoPet === "gato"
      ? { label: "Gatos", badge: "🐱 Gato" }
      : { label: "Cachorros", badge: "🐶 Cachorro" };

  const agendamentosPorAnimal = [
    {
      tipo: "cachorro" as const,
      label: "Cachorros",
      descricao: "Agendamentos de cães",
      items: agendamentos.filter(
        (agendamento) => agendamento.tipo_pet !== "gato",
      ),
    },
    {
      tipo: "gato" as const,
      label: "Gatos",
      descricao: "Agendamentos de gatos",
      items: agendamentos.filter(
        (agendamento) => agendamento.tipo_pet === "gato",
      ),
    },
  ];

  const renderAgendamentosTable = (items: AgendamentoColaborador[]) => (
    <div className="overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Animal</TableHead>
            <TableHead>Serviço</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Observações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((agendamento) => {
            const dataHora = formatDataHora(agendamento.data_hora);
            const tipoPet = getTipoPetInfo(agendamento.tipo_pet);
            return (
              <TableRow key={agendamento.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{dataHora.data}</div>
                    <div className="text-sm text-muted-foreground">
                      {dataHora.diaSemana} às {dataHora.hora}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {agendamento.clientes?.nome}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {agendamento.clientes?.telefone}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{tipoPet.badge}</Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {agendamento.servicos?.nome}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      R$ {agendamento.servicos?.preco.toFixed(2)} •{" "}
                      {agendamento.servicos?.tempo_medio}min
                    </div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(agendamento.status)}</TableCell>
                <TableCell>
                  {(() => {
                    const questionario = parseQuestionarioAnimal(
                      agendamento.observacoes,
                    );

                    if (!questionario) {
                      return (
                        <span className="text-sm">
                          {agendamento.observacoes || "-"}
                        </span>
                      );
                    }

                    return (
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">
                            Problema de saúde:
                          </span>{" "}
                          {questionario.problemaSaude}
                        </p>
                        <p>
                          <span className="font-medium">
                            Acostumado a banho e tosa:
                          </span>{" "}
                          {questionario.acostumadoBanhoTosa}
                        </p>
                        <p>
                          <span className="font-medium">
                            Restrição com banho/tosa:
                          </span>{" "}
                          {questionario.restricaoBanhoTosa}
                        </p>
                        <p>
                          <span className="font-medium">Algo a mais:</span>{" "}
                          {questionario.observacoesAdicionais}
                        </p>
                      </div>
                    );
                  })()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!funcionario && user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Acesso Restrito</CardTitle>
            <CardDescription>
              Usuário não cadastrado como funcionário. Entre em contato com o
              administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => navigate("/dashboard")}
              className="w-full"
              variant="default"
            >
              <Home className="mr-2 h-4 w-4" />
              Voltar ao Dashboard
            </Button>
            <Button
              onClick={() => navigate("/")}
              className="w-full"
              variant="outline"
            >
              Ir para Página Inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!funcionario) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">Acesso Negado</CardTitle>
            <CardDescription>
              Você precisa fazer login para acessar esta área.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Painel do Colaborador
          </h1>
          <p className="text-muted-foreground">
            Bem-vindo, {funcionario.nome}! Acompanhe seus agendamentos e ganhos.
          </p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Agendamentos Hoje
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {estatisticas.agendamentosHoje}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Agendamentos Amanhã
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {estatisticas.agendamentosAmanha}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Serviços do Mês
            </CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {estatisticas.servicosConcluidosMes}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganhos do Mês</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {estatisticas.ganhosMes.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próximos Agendamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Próximos Agendamentos
          </CardTitle>
          <CardDescription>Seus agendamentos programados</CardDescription>
        </CardHeader>
        <CardContent>
          {agendamentos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum agendamento programado
            </p>
          ) : (
            <div className="space-y-6">
              {agendamentosPorAnimal.map((grupo) => (
                <div key={grupo.tipo} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                    <div>
                      <h3 className="font-semibold">{grupo.label}</h3>
                      <p className="text-sm text-muted-foreground">
                        {grupo.descricao}
                      </p>
                    </div>
                    <Badge variant="secondary">{grupo.items.length}</Badge>
                  </div>
                  {grupo.items.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4 border rounded-lg">
                      Nenhum agendamento de {grupo.label.toLowerCase()}.
                    </p>
                  ) : (
                    renderAgendamentosTable(grupo.items.slice(0, 10))
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Ganhos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Histórico de Comissões
          </CardTitle>
          <CardDescription>Suas comissões recebidas neste mês</CardDescription>
        </CardHeader>
        <CardContent>
          {transacoes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma comissão registrada neste mês
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Valor do Serviço</TableHead>
                    <TableHead>Sua Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacoes.map((transacao) => (
                    <TableRow key={transacao.id}>
                      <TableCell>
                        {format(new Date(transacao.created_at), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {transacao.agendamentos?.servicos?.nome ||
                          "Serviço não informado"}
                      </TableCell>
                      <TableCell>
                        R$ {Number(transacao.valor_servico).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        R$ {Number(transacao.valor_comissao).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
