import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Cliente = {
  id: string;
  nome: string;
  telefone: string;
};

type Servico = {
  id: string;
  nome: string;
  preco: number;
};

type Funcionario = {
  id: string;
  nome: string;
  cargo: string;
  ativo: boolean;
};

type Agendamento = {
  id: string;
  cliente_id: string;
  servico_id: string;
  funcionario_id: string | null;
  funcionario: string;
  data_hora: string;
  status: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  tipo_pet?: string | null;
};

type ServicoQuitado = {
  id: string;
  agendamento_id: string;
  cliente_id: string;
  servico_id: string;
  funcionario_id: string | null;
  funcionario: string;
  data_hora: string;
  valor_servico: number;
  forma_pagamento: string;
  observacoes: string | null;
  data_quitacao: string;
};

const PAYMENT_OPTIONS = [
  { value: "em_aberto", label: "Em aberto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "pix", label: "Pix" },
  { value: "pacote", label: "Pacote" },
] as const;

const getPaymentLabel = (value?: string | null) =>
  PAYMENT_OPTIONS.find((option) => option.value === value)?.label || "-";

const formatLocalDateTime = (data: string, hora: string) =>
  `${data}T${hora}:00`;

const normalizePhoneToWhatsApp = (telefone?: string | null) => {
  if (!telefone) return null;

  const numeros = telefone.replace(/\D/g, "");
  if (!numeros) return null;

  if (numeros.length === 11) {
    return `55${numeros}`;
  }

  if (numeros.length === 10) {
    return `55${numeros}`;
  }

  return numeros;
};

const buildMensagemFinalizacao = (clienteNome?: string) => {
  const nomeCliente = clienteNome?.trim();
  const saudacao = nomeCliente ? `Olá, ${nomeCliente}! ` : "Olá! ";
  return `${saudacao}Seu animalzinho está limpo e cheiroso, pode vir buscá-lo.`;
};

const nextDayStart = (data: string) => {
  const d = new Date(`${data}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
};

export default function Agendamentos() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [quitados, setQuitados] = useState<ServicoQuitado[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgendamento, setEditingAgendamento] =
    useState<Agendamento | null>(null);
  const [quitandoAgendamento, setQuitandoAgendamento] =
    useState<Agendamento | null>(null);
  const [formData, setFormData] = useState({
    clienteId: "",
    servicoId: "",
    funcionarioId: "",
    data: "",
    hora: "",
    status: "agendado" as string,
    forma_pagamento: "" as string,
    observacoes: "",
    tipoPet: "cachorro" as "cachorro" | "gato",
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("agendamentos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agendamentos" },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Disparar todas as consultas em paralelo
      const [agendamentosRes, clientesRes, servicosRes, funcionariosRes, quitadosRes] =
        await Promise.all([
          supabase
            .from("agendamentos")
            .select(
              `*, clientes:cliente_id(id, nome), servicos:servico_id(id, nome, preco)`,
            )
            .order("data_hora", { ascending: true }),
          supabase.from("clientes").select("id, nome, telefone").order("nome"),
          supabase.from("servicos").select("id, nome, preco").order("nome"),
          supabase
            .from("funcionarios")
            .select("id, nome, cargo, ativo")
            .eq("ativo", true)
            .order("nome"),
          supabase
            .from("servicos_quitados" as any)
            .select("*")
            .order("data_quitacao", { ascending: false }),
        ]);

      if (agendamentosRes.error) throw agendamentosRes.error;
      if (clientesRes.error) throw clientesRes.error;
      if (servicosRes.error) throw servicosRes.error;
      if (funcionariosRes.error) throw funcionariosRes.error;
      if (quitadosRes.error) {
        console.warn("Não foi possível carregar serviços quitados:", quitadosRes.error);
      }

      setAgendamentos((agendamentosRes.data as any) || []);
      setClientes(clientesRes.data || []);
      setServicos(servicosRes.data || []);
      setFuncionarios(funcionariosRes.data || []);
      setQuitados((quitadosRes.data as any) || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    }
  };

  const getClienteNome = (clienteId: string) => {
    const cliente = clientes.find((c) => c.id === clienteId);
    return cliente?.nome || "Cliente não encontrado";
  };

  const getClienteById = (clienteId: string) =>
    clientes.find((c) => c.id === clienteId);

  const getServicoNome = (servicoId: string) => {
    const servico = servicos.find((s) => s.id === servicoId);
    return servico?.nome || "Serviço não encontrado";
  };

  const getFuncionarioNome = (funcionarioId: string | null) => {
    if (!funcionarioId) return "Funcionário não definido";
    const funcionario = funcionarios.find((f) => f.id === funcionarioId);
    return funcionario?.nome || "Funcionário não encontrado";
  };

  const filteredAgendamentos = agendamentos.filter((agendamento) => {
    const clienteNome = getClienteNome(agendamento.cliente_id).toLowerCase();
    const servicoNome = getServicoNome(agendamento.servico_id).toLowerCase();
    const funcionarioNome = getFuncionarioNome(
      agendamento.funcionario_id,
    ).toLowerCase();
    const searchLower = searchTerm.toLowerCase();

    return (
      clienteNome.includes(searchLower) ||
      servicoNome.includes(searchLower) ||
      funcionarioNome.includes(searchLower)
    );
  });

  const agendamentosPendentes = filteredAgendamentos.filter(
    (a) => a.status !== "concluido",
  );
  const agendamentosConcluidos = filteredAgendamentos.filter(
    (a) => a.status === "concluido",
  );

  const filteredQuitados = quitados.filter((q) => {
    const clienteNome = getClienteNome(q.cliente_id).toLowerCase();
    const servicoNome = getServicoNome(q.servico_id).toLowerCase();
    const funcionarioNome = getFuncionarioNome(q.funcionario_id).toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return (
      clienteNome.includes(searchLower) ||
      servicoNome.includes(searchLower) ||
      funcionarioNome.includes(searchLower)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!formData.clienteId) {
        toast.error("Selecione um cliente.");
        return;
      }
      if (!formData.servicoId) {
        toast.error("Selecione um serviço.");
        return;
      }
      if (!formData.funcionarioId) {
        toast.error("Selecione um funcionário.");
        return;
      }

      // Validação para gatos: apenas terça (2) ou quarta (3), de manhã (antes das 12:00)
      if (formData.tipoPet === "gato") {
        const [anoG, mesG, diaG] = formData.data.split("-").map(Number);
        const [horaG, minG] = formData.hora.split(":").map(Number);
        const dataValidacao = new Date(anoG, mesG - 1, diaG);
        const diaSemana = dataValidacao.getDay();
        if (diaSemana !== 2 && diaSemana !== 3) {
          toast.error("Gatos são atendidos somente às terças e quartas-feiras.");
          return;
        }
        if (horaG >= 12 || (horaG === 11 && minG > 30)) {
          toast.error("Gatos são atendidos somente no período da manhã (até 12:00).");
          return;
        }
      }

      // Forma de pagamento só é obrigatória quando o status é "quitado".
      const requerPagamento = formData.status === "quitado";
      if (requerPagamento && !formData.forma_pagamento) {
        toast.error("Selecione a forma de pagamento.");
        return;
      }

      const formaPagamentoFinal =
        formData.status === "concluido"
          ? "em_aberto"
          : requerPagamento
            ? formData.forma_pagamento
            : null;

      // Criar data/hora no timezone local do Brasil (UTC-3)
      const dataHora = formatLocalDateTime(formData.data, formData.hora);

      // Buscar tempo médio do serviço selecionado
      const { data: servicoData } = await supabase
        .from("servicos")
        .select("tempo_medio")
        .eq("id", formData.servicoId)
        .single();

      const tempoServico = servicoData?.tempo_medio || 30;
      const dataHoraInicio = new Date(dataHora);
      const dataHoraFim = new Date(
        dataHoraInicio.getTime() + tempoServico * 60000,
      );

      // Verificar se já existe agendamento do funcionário nesse horário
      const proximoDiaIso = nextDayStart(formData.data);

      const { data: agendamentosConflito } = await supabase
        .from("agendamentos")
        .select("id, data_hora, servico_id, servicos(tempo_medio)")
        .eq("funcionario_id", formData.funcionarioId)
        .eq("status", "agendado")
        .gte("data_hora", formData.data + "T00:00:00")
        .lt("data_hora", proximoDiaIso);

      // Verificar sobreposição de horários
      if (agendamentosConflito) {
        for (const ag of agendamentosConflito) {
          // Pular o próprio agendamento que está sendo editado
          if (editingAgendamento && ag.id === editingAgendamento.id) continue;

          const agInicio = new Date(ag.data_hora);
          const agTempoServico = (ag.servicos as any)?.tempo_medio || 30;
          const agFim = new Date(agInicio.getTime() + agTempoServico * 60000);

          // Verificar se há sobreposição
          if (
            (dataHoraInicio >= agInicio && dataHoraInicio < agFim) ||
            (dataHoraFim > agInicio && dataHoraFim <= agFim) ||
            (dataHoraInicio <= agInicio && dataHoraFim >= agFim)
          ) {
            toast.error(
              `Este horário conflita com outro agendamento às ${agInicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
            );
            return;
          }
        }
      }

      let enviarMensagemFinalizacao = false;
      let clienteDaFinalizacao: Cliente | undefined;

      if (editingAgendamento) {
        clienteDaFinalizacao = getClienteById(formData.clienteId);
        enviarMensagemFinalizacao =
          formData.status === "concluido" && editingAgendamento.status !== "concluido";

        // Editar agendamento existente
        const { error } = await supabase
          .from("agendamentos")
          .update({
            cliente_id: formData.clienteId,
            servico_id: formData.servicoId,
            funcionario_id: formData.funcionarioId,
            data_hora: dataHora,
            status: formData.status as any,
            forma_pagamento: formaPagamentoFinal,
            observacoes: formData.observacoes || null,
            tipo_pet: formData.tipoPet,
          } as any)
          .eq("id", editingAgendamento.id);

        if (error) throw error;
        toast.success("Agendamento atualizado com sucesso!");
      } else {
        clienteDaFinalizacao = getClienteById(formData.clienteId);
        enviarMensagemFinalizacao = formData.status === "concluido";

        // Adicionar novo agendamento
        const { error } = await supabase.from("agendamentos").insert([
          {
            cliente_id: formData.clienteId,
            servico_id: formData.servicoId,
            funcionario_id: formData.funcionarioId,
            data_hora: dataHora,
            status: formData.status as any,
            forma_pagamento: formaPagamentoFinal,
            observacoes: formData.observacoes || null,
            tipo_pet: formData.tipoPet,
          } as any,
        ]);

        if (error) throw error;
        toast.success("Agendamento criado com sucesso!");
      }

      if (enviarMensagemFinalizacao && clienteDaFinalizacao) {
        const telefoneWhatsApp = normalizePhoneToWhatsApp(
          clienteDaFinalizacao.telefone,
        );

        if (telefoneWhatsApp) {
          const mensagem = buildMensagemFinalizacao(clienteDaFinalizacao.nome);
          const whatsappUrl = `https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(mensagem)}`;
          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
          toast.success("Mensagem automática de retirada preparada no WhatsApp.");
        } else {
          toast.warning(
            "Não foi possível preparar mensagem automática: telefone do cliente inválido.",
          );
        }
      }

      fetchData(); // Recarregar dados
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar agendamento:", error);
      toast.error("Erro ao salvar agendamento");
    }
  };

  const handleEdit = (agendamento: Agendamento) => {
    setEditingAgendamento(agendamento);
    // Converter de UTC para timezone local do Brasil
    const dataHoraUTC = new Date(agendamento.data_hora);
    const ano = dataHoraUTC.getFullYear();
    const mes = String(dataHoraUTC.getMonth() + 1).padStart(2, "0");
    const dia = String(dataHoraUTC.getDate()).padStart(2, "0");
    const hora = String(dataHoraUTC.getHours()).padStart(2, "0");
    const minuto = String(dataHoraUTC.getMinutes()).padStart(2, "0");

    setFormData({
      clienteId: agendamento.cliente_id,
      servicoId: agendamento.servico_id,
      funcionarioId: agendamento.funcionario_id || "",
      data: `${ano}-${mes}-${dia}`,
      hora: `${hora}:${minuto}`,
      status: agendamento.status,
      forma_pagamento: agendamento.forma_pagamento || "",
      observacoes: agendamento.observacoes || "",
      tipoPet: ((agendamento as any).tipo_pet as "cachorro" | "gato") || "cachorro",
    });
    setIsDialogOpen(true);
  };

  const [formaPagamentoQuitar, setFormaPagamentoQuitar] = useState("");

  const handleQuitar = (agendamento: Agendamento) => {
    setQuitandoAgendamento(agendamento);
    setFormaPagamentoQuitar(
      agendamento.forma_pagamento && agendamento.forma_pagamento !== "em_aberto"
        ? agendamento.forma_pagamento
        : "",
    );
  };

  const confirmarQuitacao = async () => {
    if (!quitandoAgendamento) return;
    if (!formaPagamentoQuitar) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }

    try {
      const servico = servicos.find(
        (s) => s.id === quitandoAgendamento.servico_id,
      );
      const valorServico = Number(servico?.preco || 0);

      const { error: insertError } = await supabase
        .from("servicos_quitados" as any)
        .insert([
          {
            agendamento_id: quitandoAgendamento.id,
            cliente_id: quitandoAgendamento.cliente_id,
            servico_id: quitandoAgendamento.servico_id,
            funcionario_id: quitandoAgendamento.funcionario_id,
            funcionario: quitandoAgendamento.funcionario,
            data_hora: quitandoAgendamento.data_hora,
            valor_servico: valorServico,
            forma_pagamento: formaPagamentoQuitar,
            observacoes: quitandoAgendamento.observacoes,
          },
        ]);

      if (insertError) throw insertError;

      // Remover o agendamento original (vai para a aba Quitados via nova tabela)
      const { error: deleteError } = await supabase
        .from("agendamentos")
        .delete()
        .eq("id", quitandoAgendamento.id);

      if (deleteError) throw deleteError;

      toast.success("Serviço quitado com sucesso!");
      setQuitandoAgendamento(null);
      setFormaPagamentoQuitar("");
      fetchData();
    } catch (error: any) {
      console.error("Erro ao quitar serviço:", error);
      toast.error(error?.message || "Erro ao quitar serviço");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("agendamentos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setAgendamentos((prev) =>
        prev.filter((agendamento) => agendamento.id !== id),
      );
      toast.success("Agendamento removido com sucesso!");
    } catch (error) {
      console.error("Erro ao remover agendamento:", error);
      toast.error("Erro ao remover agendamento");
    }
  };

  const resetForm = () => {
    setFormData({
      clienteId: "",
      servicoId: "",
      funcionarioId: "",
      data: "",
      hora: "",
      status: "agendado",
      forma_pagamento: "",
      observacoes: "",
      tipoPet: "cachorro",
    });
    setEditingAgendamento(null);
    setIsDialogOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "agendado":
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            Agendado
          </Badge>
        );
      case "concluido":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            Concluído
          </Badge>
        );
      case "quitado":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            Quitado
          </Badge>
        );
      case "cancelado":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            Cancelado
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const renderMobileCards = (items: Agendamento[]) => (
    <div className="space-y-3 md:hidden">
      {items.map((agendamento) => (
        <div
          key={agendamento.id}
          className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1 min-w-0">
              <p className="font-medium text-foreground break-words">
                {getClienteNome(agendamento.cliente_id)}
              </p>
              <p className="text-sm text-muted-foreground break-words">
                {getServicoNome(agendamento.servico_id)}
              </p>
              <p className="text-sm text-muted-foreground break-words">
                {getFuncionarioNome(agendamento.funcionario_id)}
              </p>
            </div>
            <div className="flex gap-2 ml-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(agendamento)}
                className="h-8 w-8 p-0"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(agendamento.id)}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {new Date(agendamento.data_hora).toLocaleDateString("pt-BR")}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {new Date(agendamento.data_hora).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {getStatusBadge(agendamento.status)}
            <span className="text-muted-foreground">
              {getPaymentLabel(agendamento.forma_pagamento)}
            </span>
          </div>
          {agendamento.observacoes && (
            <p className="text-xs text-muted-foreground break-words">
              Obs: {agendamento.observacoes}
            </p>
          )}
          {agendamento.status === "concluido" &&
            (!agendamento.forma_pagamento ||
              agendamento.forma_pagamento === "em_aberto") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleQuitar(agendamento)}
                className="w-full"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Quitar pagamento
              </Button>
            )}
        </div>
      ))}
    </div>
  );

  const renderDesktopTable = (items: Agendamento[]) => (
    <div className="hidden md:block overflow-x-auto">
      <Table className="min-w-[900px]">
        <TableHeader>
          <TableRow className="border-b-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:bg-primary/10">
            <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Cliente</TableHead>
            <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Serviço</TableHead>
            <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Funcionário</TableHead>
            <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Data/Hora</TableHead>
            <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Status</TableHead>
            <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Pagamento</TableHead>
            <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Observações</TableHead>
            <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs text-right">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((agendamento) => (
            <TableRow
              key={agendamento.id}
              className="border-border hover:bg-secondary/20 transition-smooth"
            >
              <TableCell className="font-medium text-foreground">
                {getClienteNome(agendamento.cliente_id)}
              </TableCell>
              <TableCell className="text-foreground">
                {getServicoNome(agendamento.servico_id)}
              </TableCell>
              <TableCell className="text-foreground">
                {getFuncionarioNome(agendamento.funcionario_id)}
              </TableCell>
              <TableCell className="text-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  {new Date(agendamento.data_hora).toLocaleDateString("pt-BR")}
                  <Clock className="w-4 h-4 text-muted-foreground ml-2" />
                  {new Date(agendamento.data_hora).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(agendamento.status)}</TableCell>
              <TableCell className="text-foreground">
                {getPaymentLabel(agendamento.forma_pagamento)}
              </TableCell>
              <TableCell className="text-foreground max-w-32 truncate">
                {agendamento.observacoes || "-"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  {agendamento.status === "concluido" &&
                    (!agendamento.forma_pagamento ||
                      agendamento.forma_pagamento === "em_aberto") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleQuitar(agendamento)}
                        className="h-8 w-8 p-0"
                        title="Quitar pagamento"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(agendamento)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(agendamento.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">
            Agendamentos
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gerencie todos os agendamentos!
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[hsl(340,80%,55%)] hover:bg-[hsl(340,80%,45%)] text-white shadow-violet transition-smooth w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="gradient-card border-border w-[95vw] max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingAgendamento ? "Editar Agendamento" : "Novo Agendamento"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clienteId" className="text-foreground">
                    Cliente
                  </Label>
                  <Select
                    value={formData.clienteId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, clienteId: value }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {clientes.map((cliente) => (
                        <SelectItem
                          key={cliente.id}
                          value={cliente.id}
                          className="text-foreground"
                        >
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="servicoId" className="text-foreground">
                    Serviço
                  </Label>
                  <Select
                    value={formData.servicoId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, servicoId: value }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Selecione um serviço" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {servicos.map((servico) => (
                        <SelectItem
                          key={servico.id}
                          value={servico.id}
                          className="text-foreground"
                        >
                          {servico.nome} - R$ {Number(servico.preco).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="tipoPet" className="text-foreground">
                  Tipo do pet
                </Label>
                <Select
                  value={formData.tipoPet}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      tipoPet: value as "cachorro" | "gato",
                    }))
                  }
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="cachorro" className="text-foreground">
                      🐶 Cachorro
                    </SelectItem>
                    <SelectItem value="gato" className="text-foreground">
                      🐱 Gato (apenas terça/quarta de manhã)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formData.tipoPet === "gato" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Atendimento para gatos: terças e quartas-feiras, somente no
                    período da manhã.
                  </p>
                )}
              </div>


              {formData.status === "quitado" && (
                <div>
                  <Label htmlFor="forma_pagamento" className="text-foreground">
                    Forma de Pagamento
                  </Label>
                  <Select
                    value={formData.forma_pagamento}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        forma_pagamento: value,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {PAYMENT_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="text-foreground"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="funcionarioId" className="text-foreground">
                    Funcionário
                  </Label>
                  <Select
                    value={formData.funcionarioId}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, funcionarioId: value }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue placeholder="Selecione um funcionário" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {funcionarios.map((funcionario) => (
                        <SelectItem
                          key={funcionario.id}
                          value={funcionario.id}
                          className="text-foreground"
                        >
                          {funcionario.nome} ({funcionario.cargo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status" className="text-foreground">
                    Status
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value as any }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="agendado" className="text-foreground">
                        Agendado
                      </SelectItem>
                      <SelectItem value="concluido" className="text-foreground">
                        Concluído
                      </SelectItem>
                      <SelectItem value="quitado" className="text-foreground">
                        Quitado
                      </SelectItem>
                      <SelectItem value="cancelado" className="text-foreground">
                        Cancelado
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="data" className="text-foreground">
                    Data
                  </Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, data: e.target.value }))
                    }
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="hora" className="text-foreground">
                    Hora
                  </Label>
                  <Input
                    id="hora"
                    type="time"
                    value={formData.hora}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, hora: e.target.value }))
                    }
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes" className="text-foreground">
                  Observações
                </Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      observacoes: e.target.value,
                    }))
                  }
                  className="bg-input border-border text-foreground"
                  placeholder="Observações sobre o agendamento..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-[hsl(340,80%,55%)] hover:bg-[hsl(340,80%,45%)] text-white"
                >
                  {editingAgendamento ? "Atualizar" : "Agendar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 h-auto p-1 gap-1">
          <TabsTrigger
            value="pendentes"
            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-[11px] sm:text-sm whitespace-normal leading-tight"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="text-center">
              Agendados
              <span className="ml-1">({agendamentosPendentes.length})</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="concluidos"
            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-[11px] sm:text-sm whitespace-normal leading-tight"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-center">
              Concluídos
              <span className="ml-1">({agendamentosConcluidos.length})</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="quitados"
            className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-2 text-[11px] sm:text-sm whitespace-normal leading-tight"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-center">
              Quitados
              <span className="ml-1">({filteredQuitados.length})</span>
            </span>
          </TabsTrigger>
        </TabsList>

        <Card className="gradient-card border-border shadow-elevated">
          <CardHeader className="pb-3 md:pb-6">
            <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-foreground flex items-center gap-2 text-base md:text-lg">
                <Calendar className="w-5 h-5 text-primary" />
                Lista de Agendamentos
              </CardTitle>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar agendamentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full md:w-72 bg-input border-border"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-4 md:pb-6">
            <TabsContent value="pendentes" className="mt-0">
              {agendamentosPendentes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum agendamento pendente.
                </p>
              ) : (
                <>
                  {renderMobileCards(agendamentosPendentes)}
                  {renderDesktopTable(agendamentosPendentes)}
                </>
              )}
            </TabsContent>
            <TabsContent value="concluidos" className="mt-0">
              {agendamentosConcluidos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum agendamento concluído.
                </p>
              ) : (
                <>
                  {renderMobileCards(agendamentosConcluidos)}
                  {renderDesktopTable(agendamentosConcluidos)}
                </>
              )}
            </TabsContent>
            <TabsContent value="quitados" className="mt-0">
              {filteredQuitados.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum serviço quitado.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Mobile */}
                  <div className="space-y-3 md:hidden">
                    {filteredQuitados.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2"
                      >
                        <p className="font-medium text-foreground">
                          {getClienteNome(q.cliente_id)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getServicoNome(q.servico_id)} —{" "}
                          {getFuncionarioNome(q.funcionario_id)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            Atendido{" "}
                            {new Date(q.data_hora).toLocaleDateString("pt-BR")}
                          </span>
                          <span>
                            Quitado{" "}
                            {new Date(q.data_quitacao).toLocaleDateString(
                              "pt-BR",
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {getPaymentLabel(q.forma_pagamento)}
                          </span>
                          <span className="font-semibold text-foreground">
                            R$ {Number(q.valor_servico).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow className="border-b-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:bg-primary/10">
                          <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Cliente</TableHead>
                          <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Serviço</TableHead>
                          <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Funcionário</TableHead>
                          <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Atendimento</TableHead>
                          <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Quitado</TableHead>
                          <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs">Pagamento</TableHead>
                          <TableHead className="text-foreground font-semibold uppercase tracking-wider text-xs text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQuitados.map((q) => (
                          <TableRow key={q.id} className="border-border hover:bg-secondary/20">
                            <TableCell className="font-medium text-foreground">
                              {getClienteNome(q.cliente_id)}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {getServicoNome(q.servico_id)}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {getFuncionarioNome(q.funcionario_id)}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {new Date(q.data_hora).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {new Date(q.data_quitacao).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {getPaymentLabel(q.forma_pagamento)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-foreground">
                              R$ {Number(q.valor_servico).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* Dialog de quitação */}
      <Dialog
        open={!!quitandoAgendamento}
        onOpenChange={(open) => {
          if (!open) {
            setQuitandoAgendamento(null);
            setFormaPagamentoQuitar("");
          }
        }}
      >
        <DialogContent className="gradient-card border-border w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Quitar serviço
            </DialogTitle>
          </DialogHeader>
          {quitandoAgendamento && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="text-foreground font-medium">Cliente:</span>{" "}
                  {getClienteNome(quitandoAgendamento.cliente_id)}
                </p>
                <p>
                  <span className="text-foreground font-medium">Serviço:</span>{" "}
                  {getServicoNome(quitandoAgendamento.servico_id)}
                </p>
                <p>
                  <span className="text-foreground font-medium">Valor:</span> R${" "}
                  {Number(
                    servicos.find(
                      (s) => s.id === quitandoAgendamento.servico_id,
                    )?.preco || 0,
                  ).toFixed(2)}
                </p>
              </div>
              <div>
                <Label className="text-foreground">Forma de pagamento</Label>
                <Select
                  value={formaPagamentoQuitar}
                  onValueChange={setFormaPagamentoQuitar}
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {PAYMENT_OPTIONS.filter(
                      (o) => o.value !== "em_aberto",
                    ).map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-foreground"
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={confirmarQuitacao}
                  className="flex-1 bg-[hsl(340,80%,55%)] hover:bg-[hsl(340,80%,45%)] text-white"
                >
                  Confirmar quitação
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuitandoAgendamento(null);
                    setFormaPagamentoQuitar("");
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
