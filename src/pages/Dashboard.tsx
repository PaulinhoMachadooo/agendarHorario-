import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Scissors, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { HorariosFuncionamento } from "@/components/HorariosFuncionamento";

type Cliente = Tables<'clientes'>;
type Agendamento = Tables<'agendamentos'>;
type Servico = Tables<'servicos'>;
type Funcionario = Tables<'funcionarios'>;
type Quitado = {
  id: string;
  servico_id: string | null;
  valor_servico: number | string | null;
  data_quitacao: string | null;
  data_hora?: string | null;
};

export default function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [quitados, setQuitados] = useState<Quitado[]>([]);
  const [loading, setLoading] = useState(true);

  const agora = new Date();
  const hoje = agora.toISOString().split('T')[0];
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);

  const fetchData = async () => {
    try {
      const [clientesRes, agendamentosRes, servicosRes, funcionariosRes, quitadosRes] = await Promise.all([
        supabase.from('clientes').select('*'),
        supabase.from('agendamentos').select('*'),
        supabase.from('servicos').select('*'),
        supabase.from('funcionarios').select('*'),
        supabase.from('servicos_quitados' as any).select('*'),
      ]);

      if (clientesRes.data) setClientes(clientesRes.data);
      if (agendamentosRes.data) setAgendamentos(agendamentosRes.data);
      if (servicosRes.data) setServicos(servicosRes.data);
      if (funcionariosRes.data) setFuncionarios(funcionariosRes.data);
      if (quitadosRes && !quitadosRes.error && quitadosRes.data) {
        setQuitados(quitadosRes.data as unknown as Quitado[]);
      } else if (quitadosRes?.error) {
        console.warn('servicos_quitados indisponível:', quitadosRes.error);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  // Realtime: atualiza quando houver mudanças relevantes (substitui polling de 30s)
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agendamentos" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "servicos_quitados" }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Cálculos dos cards
  const totalClientes = clientes.length;

  const agendamentosHoje = agendamentos.filter(a => {
    const agendamentoDate = new Date(a.data_hora).toISOString().split('T')[0];
    return agendamentoDate === hoje;
  }).length;

  // Serviços realizados = agendamentos concluídos/quitados + serviços quitados avulsos
  const idsAgendamentosQuitados = new Set(
    quitados.map((q: any) => q.agendamento_id).filter(Boolean)
  );
  const agendamentosConcluidos = agendamentos.filter(
    a => a.status === 'concluido' || a.status === 'quitado'
  );
  const quitadosAvulsos = quitados.filter(
    (q: any) => !q.agendamento_id || !agendamentos.some(a => a.id === q.agendamento_id)
  );
  const servicosRealizados = agendamentosConcluidos.length + quitadosAvulsos.length;

  // Receita do mês: usa servicos_quitados quando disponível; fallback para agendamentos concluídos
  const dentroDoMes = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= inicioMes && d < fimMes;
  };

  const receitaQuitados = quitados
    .filter(q => dentroDoMes(q.data_quitacao || q.data_hora))
    .reduce((total, q) => total + Number(q.valor_servico || 0), 0);

  const receitaAgendamentos = agendamentos
    .filter(a => (a.status === 'concluido' || a.status === 'quitado') && dentroDoMes(a.data_hora))
    .filter(a => !idsAgendamentosQuitados.has(a.id)) // evita duplicar com quitados
    .reduce((total, a) => {
      const servico = servicos.find(s => s.id === a.servico_id);
      return total + (servico ? Number(servico.preco) : 0);
    }, 0);

  const receitaMes = receitaQuitados + receitaAgendamentos;

  const cards = [
    {
      title: "Clientes Cadastrados",
      value: totalClientes,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Agendamentos Hoje",
      value: agendamentosHoje,
      icon: Calendar,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Serviços Realizados",
      value: servicosRealizados,
      icon: Scissors,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Receita do Mês",
      value: `R$ ${receitaMes.toFixed(2)}`,
      icon: DollarSign,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
    },
  ];

  return (
    <div className="space-y-4 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Bem-vindo ao painel de controle do seu estabelecimento!
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {cards.map((card, index) => (
          <Card key={index} className="gradient-card border-border shadow-elevated transition-smooth hover:shadow-violet hover:scale-105">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <card.icon className={`w-4 h-4 md:w-5 md:h-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-lg md:text-2xl font-bold text-foreground">
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6">
        <HorariosFuncionamento />

        <Card className="gradient-card border-border shadow-elevated">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Próximos Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Agrupa agendamentos por data
              const grupos = new Map<string, Agendamento[]>();
              const agendamentosOrdenados = agendamentos
                .filter(a => a.status === 'agendado')
                .sort((a, b) => new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime());

              agendamentosOrdenados.forEach(a => {
                const dataStr = new Date(a.data_hora).toISOString().split('T')[0];
                if (!grupos.has(dataStr)) grupos.set(dataStr, []);
                grupos.get(dataStr)!.push(a);
              });

              return Array.from(grupos.entries()).map(([dataStr, lista]) => {
                const data = new Date(dataStr + 'T00:00:00');
                const dataAmanha = new Date(agora);
                dataAmanha.setDate(dataAmanha.getDate() + 1);
                const hojeStr = agora.toISOString().split('T')[0];
                const amanhaStr = dataAmanha.toISOString().split('T')[0];

                let label: string;
                if (dataStr === hojeStr) {
                  label = 'Hoje';
                } else if (dataStr === amanhaStr) {
                  label = 'Amanhã';
                } else {
                  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                  label = `${diasSemana[data.getDay()]}, ${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}`;
                }

                return (
                  <div key={dataStr} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                      {label}
                    </p>
                    {lista.map((agendamento) => {
                      const cliente = clientes.find(c => c.id === agendamento.cliente_id);
                      const servico = servicos.find(s => s.id === agendamento.servico_id);
                      return (
                        <div key={agendamento.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {new Date(agendamento.data_hora).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })} - {funcionarios.find(f => f.id === agendamento.funcionario_id)?.nome || 'Profissional não encontrado'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-primary">
                              {cliente?.nome || 'Cliente não encontrado'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {servico?.nome || 'Serviço não encontrado'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>

        <Card className="gradient-card border-border shadow-elevated">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Serviços Populares
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {servicos.map((servico) => (
                <div key={servico.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                  <div>
                    <p className="font-medium text-foreground">{servico.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {servico.tempo_medio} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">R$ {Number(servico.preco).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}