import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CalendarIcon,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  User,
  Scissors,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  addDays,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface ConfiguracoesBarbearia {
  nome: string;
  endereco: string;
  telefone: string;
  horario_abertura: string;
  horario_fechamento: string;
  horario_almoco_inicio: string | null;
  horario_almoco_fim: string | null;
  logo_url: string;
  banner_url: string;
}

export default function AgendamentoPublico() {
  const { toast } = useToast();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [configuracoes, setConfiguracoes] =
    useState<ConfiguracoesBarbearia | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    servico_id: "",
    funcionario_id: "",
    horario: "",
    observacoes: "",
    problema_saude: "",
    acostumado_banho: "",
    restricao: "",
    obs_animal: "",
    tipo_pet: "cachorro" as "cachorro" | "gato",
  });

  const toLocalDateTimeString = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const offsetMin = -date.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMin);
    const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${offset}`;
  };

  useEffect(() => {
    fetchDados();
  }, []);

  useEffect(() => {
    if (selectedDate && formData.funcionario_id && formData.servico_id) {
      fetchHorariosDisponiveis();
    }
  }, [selectedDate, formData.funcionario_id, formData.servico_id, formData.tipo_pet]);

  const fetchDados = async () => {
    try {
      const [servicosResult, funcionariosResult, configResult] =
        await Promise.all([
          supabase.from("servicos").select("*").order("nome"),
          supabase
            .from("funcionarios")
            .select("id, nome, cargo")
            .eq("ativo", true),
          supabase.from("configuracoes_barbearia").select("*").maybeSingle(),
        ]);

      if (servicosResult.error) throw servicosResult.error;
      if (funcionariosResult.error) throw funcionariosResult.error;
      if (configResult.error) throw configResult.error;

      setServicos(servicosResult.data || []);
      setFuncionarios(funcionariosResult.data || []);
      setConfiguracoes(configResult.data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchHorariosDisponiveis = async () => {
    if (
      !selectedDate ||
      !formData.funcionario_id ||
      !formData.servico_id ||
      !configuracoes
    )
      return;

    try {
      const dataFormatada = format(selectedDate, "yyyy-MM-dd");

      // Buscar agendamentos existentes para o funcionário na data
      const { data: agendamentos, error } = await supabase
        .from("agendamentos")
        .select("data_hora, servicos(tempo_medio)")
        .eq("funcionario_id", formData.funcionario_id)
        .gte("data_hora", `${dataFormatada}T00:00:00`)
        .lt("data_hora", `${dataFormatada}T23:59:59`)
        .neq("status", "cancelado");

      if (error) throw error;

      // Buscar duração do serviço selecionado
      const servicoSelecionado = servicos.find(
        (s) => s.id === formData.servico_id,
      );
      if (!servicoSelecionado) return;

      // Gerar horários disponíveis
      const horarios = gerarHorarios(
        configuracoes.horario_abertura,
        configuracoes.horario_fechamento,
        agendamentos || [],
        servicoSelecionado.tempo_medio,
        configuracoes.horario_almoco_inicio,
        configuracoes.horario_almoco_fim,
      );

      // Para gatos: somente período da manhã (antes do almoço, ou antes das 12:00)
      let horariosFiltrados = horarios;
      if (formData.tipo_pet === "gato") {
        const limiteManha = configuracoes.horario_almoco_inicio || "12:00";
        const [hLim, mLim] = limiteManha.split(":").map(Number);
        const limiteMin = hLim * 60 + mLim;
        horariosFiltrados = horarios.filter((h) => {
          const [hh, mm] = h.split(":").map(Number);
          return hh * 60 + mm < limiteMin;
        });
      }

      setHorariosDisponiveis(horariosFiltrados);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar horários",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const gerarHorarios = (
    abertura: string,
    fechamento: string,
    agendamentos: any[],
    duracaoServico: number,
    almocoInicio?: string | null,
    almocoFim?: string | null,
  ): string[] => {
    const horarios: string[] = [];
    const [horaAbertura, minutoAbertura] = abertura.split(":").map(Number);
    const [horaFechamento, minutoFechamento] = fechamento
      .split(":")
      .map(Number);

    const inicioMinutos = horaAbertura * 60 + minutoAbertura;
    const fimMinutos = horaFechamento * 60 + minutoFechamento;

    // Intervalo de almoço (em minutos do dia)
    let almocoIniMin: number | null = null;
    let almocoFimMin: number | null = null;
    if (almocoInicio && almocoFim) {
      const [hAi, mAi] = almocoInicio.split(":").map(Number);
      const [hAf, mAf] = almocoFim.split(":").map(Number);
      almocoIniMin = hAi * 60 + mAi;
      almocoFimMin = hAf * 60 + mAf;
    }

    // Criar lista de horários ocupados
    const horariosOcupados = agendamentos.map((agendamento) => {
      const dataHora = new Date(agendamento.data_hora);
      const inicioOcupado = dataHora.getHours() * 60 + dataHora.getMinutes();
      const fimOcupado =
        inicioOcupado + (agendamento.servicos?.tempo_medio || 30);
      return { inicio: inicioOcupado, fim: fimOcupado };
    });

    // Gerar slots de 30 em 30 minutos
    for (
      let minutos = inicioMinutos;
      minutos + duracaoServico <= fimMinutos;
      minutos += 30
    ) {
      const fimSlot = minutos + duracaoServico;

      // Verificar se há conflito com agendamentos existentes
      const temConflito = horariosOcupados.some(
        (ocupado) => minutos < ocupado.fim && fimSlot > ocupado.inicio,
      );

      // Verificar se cruza o horário de almoço
      const conflitaAlmoco =
        almocoIniMin !== null &&
        almocoFimMin !== null &&
        minutos < almocoFimMin &&
        fimSlot > almocoIniMin;

      if (!temConflito && !conflitaAlmoco) {
        const hora = Math.floor(minutos / 60);
        const minuto = minutos % 60;
        horarios.push(
          `${hora.toString().padStart(2, "0")}:${minuto.toString().padStart(2, "0")}`,
        );
      }
    }

    return horarios;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Primeiro, criar ou buscar o cliente
      let clienteId;

      const { data: clienteExistente } = await supabase
        .from("clientes")
        .select("id")
        .eq("email", formData.email)
        .maybeSingle();

      if (clienteExistente) {
        clienteId = clienteExistente.id;
      } else {
        const { data: novoCliente, error: clienteError } = await supabase
          .from("clientes")
          .insert([
            {
              nome: formData.nome,
              telefone: formData.telefone,
              email: formData.email,
            },
          ])
          .select()
          .single();

        if (clienteError) throw clienteError;
        clienteId = novoCliente.id;
      }

      // Criar o agendamento (com timezone local)
      const [hh, mm] = formData.horario.split(":").map(Number);
      const dt = new Date(selectedDate!);
      dt.setHours(hh, mm, 0, 0);
      const dataHora = toLocalDateTimeString(dt);

      const observacoesCompletas = [
        formData.observacoes,
        "Questionário do animal:",
        `- Problema de saúde: ${formData.problema_saude || "Não informado"}`,
        `- Acostumado a banho e tosa: ${formData.acostumado_banho || "Não informado"}`,
        `- Restrição com banho/tosa: ${formData.restricao || "Não informado"}`,
        `- Observações adicionais: ${formData.obs_animal || "Não informado"}`,
      ]
        .filter(Boolean)
        .join("\n");

      const { error: agendamentoError } = await supabase
        .from("agendamentos")
        .insert([
          {
            cliente_id: clienteId,
            servico_id: formData.servico_id,
            funcionario_id: formData.funcionario_id,
            data_hora: dataHora,
            status: "agendado" as any,
            observacoes: observacoesCompletas,
            tipo_pet: formData.tipo_pet,
          } as any,
        ]);

      if (agendamentoError) throw agendamentoError;

      toast({
        title: "Agendamento realizado com sucesso!",
        description: "Você receberá uma confirmação em breve.",
      });

      // Resetar formulário
      setFormData({
        nome: "",
        telefone: "",
        email: "",
        servico_id: "",
        funcionario_id: "",
        horario: "",
        observacoes: "",
        problema_saude: "",
        acostumado_banho: "",
        restricao: "",
        obs_animal: "",
        tipo_pet: "cachorro",
      });
      setSelectedDate(undefined);
      setHorariosDisponiveis([]);
    } catch (error: any) {
      toast({
        title: "Erro ao agendar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    const hoje = startOfDay(new Date());
    const maxDate = addDays(hoje, 30); // Limitar a 30 dias no futuro
    if (isBefore(date, hoje) || isAfter(date, maxDate)) return true;
    // Gatos: somente terças (2) e quartas (3)
    if (formData.tipo_pet === "gato") {
      const dia = date.getDay();
      if (dia !== 2 && dia !== 3) return true;
    }
    return false;
  };

  if (!configuracoes) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header da Barbearia */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center space-x-4">
            {configuracoes.logo_url && (
              <img
                src={configuracoes.logo_url}
                alt={configuracoes.nome}
                className="h-12 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="text-center">
              <h1 className="text-3xl font-bold">{configuracoes.nome}</h1>
              <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground mt-2">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{configuracoes.endereco}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Phone className="h-4 w-4" />
                  <span>{configuracoes.telefone}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner */}
      {configuracoes.banner_url && (
        <div
          className="h-48 bg-cover bg-center"
          style={{ backgroundImage: `url(${configuracoes.banner_url})` }}
        >
          <div className="h-full bg-black/30 flex items-center justify-center">
            <div className="text-center text-white">
              <h2 className="text-2xl font-bold mb-2">
                Agende seu horário online
              </h2>
              <p>Rápido, fácil e conveniente</p>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de Agendamento */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6" />
                Novo Agendamento
              </CardTitle>
              <CardDescription>
                Preencha os dados abaixo para agendar seu atendimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados do Cliente */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Seus Dados
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome Completo</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            nome: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            telefone: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Tipo do pet</Label>
                      <Select
                        value={formData.tipo_pet}
                        onValueChange={(value) => {
                          setFormData((prev) => ({
                            ...prev,
                            tipo_pet: value as "cachorro" | "gato",
                            horario: "",
                          }));
                          setSelectedDate(undefined);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cachorro">🐶 Cachorro</SelectItem>
                          <SelectItem value="gato">🐱 Gato</SelectItem>
                        </SelectContent>
                      </Select>
                      {formData.tipo_pet === "gato" && (
                        <p className="text-xs text-muted-foreground">
                          Atendimento para gatos: apenas terças e quartas-feiras, no período da manhã.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Seleção de Serviço */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Scissors className="h-5 w-5" />
                    Escolha o Serviço
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {servicos.map((servico) => (
                      <Card
                        key={servico.id}
                        className={`cursor-pointer border-2 transition-colors ${
                          formData.servico_id === servico.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            servico_id: servico.id,
                          }))
                        }
                      >
                        <CardContent className="p-4">
                          <h4 className="font-semibold">{servico.nome}</h4>
                          <div className="flex justify-between items-center mt-2">
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {servico.tempo_medio}min
                            </Badge>
                            <span className="font-bold text-primary">
                              R$ {servico.preco.toFixed(2)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Seleção de Profissional */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Escolha o Profissional
                  </h3>
                  <Select
                    value={formData.funcionario_id}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        funcionario_id: value,
                      }))
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um profissional" />
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

                <Separator />

                {/* Seleção de Data e Horário */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Data e Horário
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <Label>Escolha a Data</Label>
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={isDateDisabled}
                        locale={ptBR}
                        className="rounded-md border"
                      />
                    </div>

                    <div>
                      <Label>Horários Disponíveis</Label>
                      {!selectedDate ||
                      !formData.funcionario_id ||
                      !formData.servico_id ? (
                        <p className="text-muted-foreground mt-2">
                          Selecione o serviço, profissional e data para ver os
                          horários
                        </p>
                      ) : horariosDisponiveis.length === 0 ? (
                        <p className="text-muted-foreground mt-2">
                          Nenhum horário disponível para esta data
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {horariosDisponiveis.map((horario) => (
                            <Button
                              key={horario}
                              type="button"
                              variant={
                                formData.horario === horario
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() =>
                                setFormData((prev) => ({ ...prev, horario }))
                              }
                            >
                              {horario}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Questionário do animal */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Questionário sobre o animal
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>O animal possui algum problema de saúde?</Label>
                      <Select
                        value={formData.problema_saude}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, problema_saude: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>É acostumado a banho e tosa?</Label>
                      <Select
                        value={formData.acostumado_banho}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, acostumado_banho: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Possui alguma restrição com banho/tosa?</Label>
                      <Select
                        value={formData.restricao}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, restricao: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="obs_animal">Observações adicionais sobre o animal</Label>
                      <Input
                        id="obs_animal"
                        value={formData.obs_animal}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, obs_animal: e.target.value }))
                        }
                        placeholder="Ex: porte, raça, comportamento..."
                      />
                    </div>
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações (opcional)</Label>
                  <Input
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        observacoes: e.target.value,
                      }))
                    }
                    placeholder="Alguma observação especial?"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !formData.horario || !selectedDate}
                >
                  {loading ? "Agendando..." : "Confirmar Agendamento"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
