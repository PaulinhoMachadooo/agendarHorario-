import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CalendarDays, DollarSign, Users, Scissors, TrendingUp, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RelatorioData {
  faturamentoTotal: number;
  servicosRealizados: number;
  agendamentosCompletos: number;
  agendamentosCancelados: number;
  valorProfissionais: number;
  valorLiquido: number;
  clientesEmAberto: number;
  valorEmAberto: number;
  faturamentoPorDia: Array<{ data: string; valor: number }>;
  servicosPopulares: Array<{ nome: string; quantidade: number; valor: number }>;
  performanceProfissionais: Array<{ nome: string; servicos: number; comissao: number }>;
  formasPagamento: Array<{ forma: string; quantidade: number }>;
  transacoesRaw: Array<{ created_at: string; valor_servico: number }>;
}

export default function Relatorios() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [periodoGrafico, setPeriodoGrafico] = useState<10 | 30 | 90>(10);

  useEffect(() => {
    gerarRelatorio();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("relatorios-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agendamentos" },
        () => gerarRelatorio(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transacoes_financeiras" },
        () => gerarRelatorio(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dataInicio, dataFim]);

  const gerarRelatorio = async () => {
    setLoading(true);
    try {
      const dataFimExclusiva = new Date(`${dataFim}T00:00:00`);
      dataFimExclusiva.setDate(dataFimExclusiva.getDate() + 1);
      const dataFimExclusivaIso = dataFimExclusiva.toISOString().slice(0, 19);
      // Disparar todas as consultas em paralelo
      const [agendamentosRes, transacoesRes, quitadosRes, servicosCatalogRes, comissoesRes] =
        await Promise.all([
          supabase
            .from('agendamentos')
            .select(`*, servicos(nome, preco), funcionarios(nome)`)
            .gte('data_hora', dataInicio)
            .lt('data_hora', dataFimExclusivaIso),
          supabase
            .from('transacoes_financeiras')
            .select(`*, funcionarios(nome)`)
            .gte('created_at', dataInicio)
            .lt('created_at', dataFimExclusivaIso),
          supabase
            .from('quitados')
            .select('*')
            .gte('data_quitacao', dataInicio)
            .lt('data_quitacao', dataFimExclusivaIso),
          supabase.from('servicos').select('id, nome, preco'),
          supabase.from('comissoes').select('funcionario_id, tipo_comissao, valor, created_at'),
        ]);

      if (agendamentosRes.error) throw agendamentosRes.error;
      if (transacoesRes.error) throw transacoesRes.error;
      if (quitadosRes.error) {
        console.warn('quitados indisponível:', quitadosRes.error);
      }
      if (comissoesRes.error) throw comissoesRes.error;

      const agendamentos = agendamentosRes.data;
      const transacoes = transacoesRes.data;
      const quitados = quitadosRes.data;
      const servicosCatalog = servicosCatalogRes.data;
      const comissoes = comissoesRes.data;

      const servicoById = new Map<string, { nome: string; preco: number }>();
      (servicosCatalog || []).forEach((s: any) => {
        servicoById.set(s.id, { nome: s.nome, preco: Number(s.preco) });
      });

      // Calcular métricas
      const agendamentosCompletos = agendamentos?.filter(a => a.status === 'concluido' || a.status === 'quitado') || [];
      const agendamentosCancelados = agendamentos?.filter(a => a.status === 'cancelado') || [];
      
      const comissaoMap = new Map<string, { tipo_comissao: string; valor: number; created_at: string }>();
      (comissoes || []).forEach((comissao: any) => {
        const atual = comissaoMap.get(comissao.funcionario_id);
        if (!atual || new Date(comissao.created_at) > new Date(atual.created_at)) {
          comissaoMap.set(comissao.funcionario_id, {
            tipo_comissao: comissao.tipo_comissao,
            valor: Number(comissao.valor),
            created_at: comissao.created_at,
          });
        }
      });

      const transacoesExistentes = transacoes || [];
      const agendamentosComTransacao = new Set(
        transacoesExistentes
          .map((t: any) => t.agendamento_id)
          .filter(Boolean)
      );

      const transacoesFallback = agendamentosCompletos
        .filter((ag: any) => !agendamentosComTransacao.has(ag.id))
        .map((ag: any) => {
          const valorServico = Number(ag.servicos?.preco || 0);
          const regraComissao = ag.funcionario_id ? comissaoMap.get(ag.funcionario_id) : null;
          const valorComissao = !regraComissao
            ? 0
            : regraComissao.tipo_comissao === 'porcentagem'
              ? (valorServico * Number(regraComissao.valor)) / 100
              : Number(regraComissao.valor);

          return {
            id: `fallback-${ag.id}`,
            agendamento_id: ag.id,
            created_at: ag.data_hora,
            valor_servico: valorServico,
            valor_comissao: valorComissao,
            forma_pagamento: ag.forma_pagamento || null,
            funcionarios: ag.funcionarios || null,
          };
        });

      // Quitados que não estão refletidos em transações nem em agendamentos do período
      const agendamentoIdsCompletos = new Set(agendamentosCompletos.map((a: any) => a.id));
      const quitadosExtras = (quitados || []).filter((q: any) => {
        if (q.agendamento_id && agendamentosComTransacao.has(q.agendamento_id)) return false;
        if (q.agendamento_id && agendamentoIdsCompletos.has(q.agendamento_id)) return false;
        return true;
      }).map((q: any) => {
        const valorServico = Number(q.valor_servico ?? (q.servico_id ? servicoById.get(q.servico_id)?.preco : 0) ?? 0);
        const regraComissao = q.funcionario_id ? comissaoMap.get(q.funcionario_id) : null;
        const valorComissao = !regraComissao
          ? 0
          : regraComissao.tipo_comissao === 'porcentagem'
            ? (valorServico * Number(regraComissao.valor)) / 100
            : Number(regraComissao.valor);
        return {
          id: `quitado-${q.id}`,
          agendamento_id: q.agendamento_id,
          created_at: q.data_quitacao || q.data_hora || q.created_at,
          valor_servico: valorServico,
          valor_comissao: valorComissao,
          forma_pagamento: q.forma_pagamento || null,
          funcionarios: null,
        };
      });

      const transacoesEfetivas = [...transacoesExistentes, ...transacoesFallback, ...quitadosExtras];

      const faturamentoTotal = transacoesEfetivas.reduce((sum, t: any) => sum + Number(t.valor_servico || 0), 0);
      const valorProfissionais = transacoesEfetivas.reduce((sum, t: any) => sum + Number(t.valor_comissao || 0), 0);
      const valorLiquido = faturamentoTotal - valorProfissionais;

      const agendamentosEmAberto = agendamentosCompletos.filter(
        (a: any) =>
          a.status !== "quitado" &&
          (!a.forma_pagamento || a.forma_pagamento === "em_aberto"),
      );
      const clientesEmAberto = agendamentosEmAberto.length;
      const valorEmAberto = agendamentosEmAberto.reduce(
        (sum: number, a: any) => sum + Number(a.servicos?.preco || 0),
        0,
      );

      // Faturamento por dia — últimos 10 dias (preenche dias sem faturamento com 0)
      const totaisPorDia = new Map<string, number>();
      transacoesEfetivas.forEach((transacao: any) => {
        const chave = format(parseISO(transacao.created_at), 'yyyy-MM-dd');
        totaisPorDia.set(chave, (totaisPorDia.get(chave) || 0) + Number(transacao.valor_servico));
      });

      const faturamentoPorDia = Array.from({ length: 10 }).map((_, idx) => {
        const dia = new Date();
        dia.setHours(0, 0, 0, 0);
        dia.setDate(dia.getDate() - (9 - idx));
        const chave = format(dia, 'yyyy-MM-dd');
        return {
          data: format(dia, 'dd/MM', { locale: ptBR }),
          valor: totaisPorDia.get(chave) || 0,
        };
      });

      // Serviços mais populares: combina agendamentos concluídos + quitados
      const servicosMap = new Map<string, { nome: string; quantidade: number; valor: number }>();
      const addServico = (nome: string, valor: number) => {
        if (!nome) return;
        const existing = servicosMap.get(nome);
        if (existing) {
          servicosMap.set(nome, { nome, quantidade: existing.quantidade + 1, valor: existing.valor + valor });
        } else {
          servicosMap.set(nome, { nome, quantidade: 1, valor });
        }
      };
      agendamentosCompletos.forEach((agendamento: any) => {
        const s = agendamento.servicos;
        if (s) addServico(s.nome, Number(s.preco));
      });
      (quitados || []).forEach((q: any) => {
        // Evita contar duas vezes o mesmo agendamento
        if (q.agendamento_id && agendamentosCompletos.some((a: any) => a.id === q.agendamento_id)) return;
        const fromCatalog = q.servico_id ? servicoById.get(q.servico_id) : null;
        const nome = fromCatalog?.nome || 'Serviço';
        const valor = Number(q.valor_servico ?? fromCatalog?.preco ?? 0);
        addServico(nome, valor);
      });

      const servicosPopulares = Array.from(servicosMap.values())
        .sort((a, b) => b.quantidade - a.quantidade);

      // Performance dos profissionais (a partir das transações efetivas)
      const profissionaisMap = new Map<string, { nome: string; servicos: number; comissao: number }>();
      transacoesEfetivas.forEach((transacao: any) => {
        const nome = transacao.funcionarios?.nome || 'Não informado';
        const existing = profissionaisMap.get(nome);
        if (existing) {
          profissionaisMap.set(nome, {
            nome,
            servicos: existing.servicos + 1,
            comissao: existing.comissao + Number(transacao.valor_comissao || 0),
          });
        } else {
          profissionaisMap.set(nome, {
            nome,
            servicos: 1,
            comissao: Number(transacao.valor_comissao || 0),
          });
        }
      });
      const performanceProfissionais = Array.from(profissionaisMap.values())
        .sort((a, b) => b.servicos - a.servicos);

      // Formas de pagamento: prioriza quitados; se vazio, usa transacoes
      const formasPagamentoMap = new Map<string, number>();
      const fontePagamento: any[] = (quitados && quitados.length > 0)
        ? quitados
        : transacoesEfetivas;
      fontePagamento.forEach((item: any) => {
        const forma = (item.forma_pagamento && String(item.forma_pagamento).trim()) || 'em_aberto';
        formasPagamentoMap.set(forma, (formasPagamentoMap.get(forma) || 0) + 1);
      });

      const pagamentoLabelMap: Record<string, string> = {
        dinheiro: 'Dinheiro',
        cartao_debito: 'Cartão Débito',
        cartao_credito: 'Cartão de Crédito',
        pix: 'Pix',
        pacote: 'Pacote',
        em_aberto: 'Em aberto',
        nao_informado: 'Não informado',
      };

      const formasPagamento = Array.from(formasPagamentoMap.entries())
        .map(([forma, quantidade]) => ({
          forma: pagamentoLabelMap[forma] || forma,
          quantidade,
        }))
        .sort((a, b) => b.quantidade - a.quantidade);

      // Quitados avulsos (não vinculados a um agendamento já contado) — evita duplicidade
      const quitadosAvulsos = (quitados || []).filter((q: any) => {
        if (!q.agendamento_id) return true;
        return !agendamentosCompletos.some((a: any) => a.id === q.agendamento_id);
      });
      const totalConcluidos = agendamentosCompletos.length + quitadosAvulsos.length;

      setRelatorio({
        faturamentoTotal,
        servicosRealizados: totalConcluidos,
        agendamentosCompletos: totalConcluidos,
        agendamentosCancelados: agendamentosCancelados.length,
        valorProfissionais,
        valorLiquido,
        clientesEmAberto,
        valorEmAberto,
        faturamentoPorDia,
        servicosPopulares,
        performanceProfissionais,
        formasPagamento,
        transacoesRaw: transacoesEfetivas.map((t: any) => ({
          created_at: t.created_at,
          valor_servico: Number(t.valor_servico) || 0,
        })),
      });

    } catch (error: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  const statusData = relatorio ? [
    { name: 'Concluídos', value: relatorio.agendamentosCompletos },
    { name: 'Cancelados', value: relatorio.agendamentosCancelados }
  ] : [];

  const faturamentoGrafico = (() => {
    const totais = new Map<string, number>();
    (relatorio?.transacoesRaw ?? []).forEach((t) => {
      const chave = format(parseISO(t.created_at), 'yyyy-MM-dd');
      totais.set(chave, (totais.get(chave) || 0) + Number(t.valor_servico));
    });
    return Array.from({ length: periodoGrafico }).map((_, idx) => {
      const dia = new Date();
      dia.setHours(0, 0, 0, 0);
      dia.setDate(dia.getDate() - (periodoGrafico - 1 - idx));
      const chave = format(dia, 'yyyy-MM-dd');
      return {
        data: format(dia, 'dd/MM', { locale: ptBR }),
        valor: totais.get(chave) || 0,
      };
    });
  })();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm md:text-base text-muted-foreground">Análise detalhada do desempenho!</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Período do Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data Início</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-fim">Data Fim</Label>
              <Input
                id="data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <Button onClick={gerarRelatorio} disabled={loading}>
              {loading ? "Gerando..." : "Gerar Relatório"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {relatorio && (
        <>
          {/* Cards de Métricas */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Faturamento Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold text-primary">
                  R$ {relatorio.faturamentoTotal.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">valores realizados no período</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Serviços Realizados</CardTitle>
                <Scissors className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold text-primary">{relatorio.servicosRealizados}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {relatorio.servicosRealizados === 1 ? 'atendimento concluído' : 'atendimentos concluídos'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Pago aos Profissionais</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold">
                  R$ {relatorio.valorProfissionais.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Valor Líquido</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold text-green-600">
                  R$ {relatorio.valorLiquido.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <CardTitle className="text-xs md:text-sm font-medium">Clientes em Aberto</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <div className="text-lg md:text-2xl font-bold text-amber-600">
                  {relatorio.clientesEmAberto}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {relatorio.valorEmAberto.toFixed(2)} pendente
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Faturamento por Dia</CardTitle>
                <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
                  {[10, 30, 90].map((dias) => (
                    <button
                      key={dias}
                      type="button"
                      onClick={() => setPeriodoGrafico(dias as 10 | 30 | 90)}
                      className={`px-3 py-1 rounded-sm transition-colors ${
                        periodoGrafico === dias
                          ? "bg-background text-foreground shadow-sm font-medium"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {dias} dias
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={faturamentoGrafico}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`R$ ${Number(value).toFixed(2)}`, 'Faturamento']} />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status dos Agendamentos</CardTitle>
                <CardDescription>Total de concluídos e cancelados no período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-lg border bg-primary/5 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Concluídos</p>
                    <p className="text-2xl font-bold text-primary">{relatorio.agendamentosCompletos}</p>
                  </div>
                  <div className="rounded-lg border bg-destructive/5 p-3 text-center">
                    <p className="text-xs text-muted-foreground">Cancelados</p>
                    <p className="text-2xl font-bold text-destructive">{relatorio.agendamentosCancelados}</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Formas de Pagamento Mais Utilizadas</CardTitle>
              <CardDescription>
                Quantidade de atendimentos por forma de pagamento (incluindo em aberto)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relatorio.formasPagamento.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pagamento registrado no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={relatorio.formasPagamento}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ forma, quantidade }) => `${forma}: ${quantidade}`}
                      outerRadius={100}
                      dataKey="quantidade"
                      nameKey="forma"
                    >
                      {relatorio.formasPagamento.map((_, index) => (
                        <Cell key={`cell-fp-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [Number(value), name]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Serviços e Profissionais em números */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base md:text-lg">Serviços Mais Populares</CardTitle>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {relatorio.servicosPopulares.reduce((sum, s) => sum + s.quantidade, 0)} no total
                  </span>
                </div>
                <CardDescription>Ranking dos serviços mais realizados</CardDescription>
              </CardHeader>
              <CardContent>
                {relatorio.servicosPopulares.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum serviço no período.</p>
                ) : (
                  <div className="space-y-3">
                    {relatorio.servicosPopulares.slice(0, 5).map((servico, index) => (
                      <div key={servico.nome} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {index + 1}º
                          </span>
                          <div>
                            <p className="text-sm font-medium leading-tight">{servico.nome}</p>
                            <p className="text-xs text-muted-foreground">{servico.quantidade} atendimento{servico.quantidade !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-lg font-bold leading-none text-primary">{servico.quantidade}</span>
                          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">R$ {Number(servico.valor).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg">Performance dos Profissionais</CardTitle>
                <CardDescription>Serviços realizados e comissão</CardDescription>
              </CardHeader>
              <CardContent>
                {relatorio.performanceProfissionais.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum profissional no período.</p>
                ) : (
                  <div className="space-y-3">
                    {relatorio.performanceProfissionais.map((prof, index) => (
                      <div key={prof.nome} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent-foreground">
                            {index + 1}º
                          </span>
                          <div>
                            <p className="text-sm font-medium leading-tight">{prof.nome}</p>
                            <p className="text-xs text-muted-foreground">{prof.servicos} serviço{prof.servicos !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap">R$ {Number(prof.comissao).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
