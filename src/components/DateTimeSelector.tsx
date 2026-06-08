import React, { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Clock } from "lucide-react";
import {
  format,
  parse,
  isBefore,
  startOfDay,
  addMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConfiguracoesBarbearia {
  horario_abertura: string;
  horario_fechamento: string;
  horario_almoco_inicio: string | null;
  horario_almoco_fim: string | null;
  dias_funcionamento: string[];
}

interface DateTimeSelectorProps {
  selectedDate: Date | undefined;
  selectedTime: string;
  funcionarioId: string;
  servicoId: string;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
}

const toLocalDateTimeString = (date: Date) =>
  format(date, "yyyy-MM-dd'T'HH:mm:ss");

export function DateTimeSelector({
  selectedDate,
  selectedTime,
  funcionarioId,
  servicoId,
  onDateChange,
  onTimeChange,
}: DateTimeSelectorProps) {
  const { toast } = useToast();
  const [configuracoes, setConfiguracoes] =
    useState<ConfiguracoesBarbearia | null>(null);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [agendamentosExistentes, setAgendamentosExistentes] = useState<
    { data_hora: string; tempo_servico: number }[]
  >([]);
  const [tempoServico, setTempoServico] = useState(30); // tempo padrão

  useEffect(() => {
    fetchConfiguracoes();
  }, []);

  useEffect(() => {
    if (servicoId) {
      fetchTempoServico(servicoId);
    }
  }, [servicoId]);

  useEffect(() => {
    if (selectedDate && configuracoes && funcionarioId) {
      fetchAgendamentosExistentes(selectedDate, funcionarioId);
    }
  }, [selectedDate, configuracoes, funcionarioId]);

  const fetchConfiguracoes = async () => {
    const { data, error } = await supabase
      .from("configuracoes_barbearia")
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações da barbearia",
        variant: "destructive",
      });
      return;
    }

    if (data) {
      setConfiguracoes(data);
    }
  };

  const fetchTempoServico = async (servicoId: string) => {
    const { data, error } = await supabase
      .from("servicos")
      .select("tempo_medio")
      .eq("id", servicoId)
      .single();

    if (!error && data) {
      setTempoServico(data.tempo_medio);
    }
  };

  const fetchAgendamentosExistentes = async (date: Date, funcId: string) => {
    const startOfDayDate = startOfDay(date);
    const endOfDayDate = new Date(startOfDayDate);
    endOfDayDate.setDate(endOfDayDate.getDate() + 1);

    const { data, error } = await supabase
      .from("agendamentos")
      .select("data_hora, servico_id")
      .eq("funcionario_id", funcId)
      .eq("status", "agendado")
      .gte("data_hora", toLocalDateTimeString(startOfDayDate))
      .lt("data_hora", toLocalDateTimeString(endOfDayDate));

    if (error) {
      console.error("Erro ao buscar agendamentos:", error);
      return;
    }

    // Buscar tempo de cada serviço dos agendamentos
    if (data && data.length > 0) {
      const agendamentosComTempo = await Promise.all(
        data.map(async (ag) => {
          const { data: servico } = await supabase
            .from("servicos")
            .select("tempo_medio")
            .eq("id", ag.servico_id)
            .single();

          return {
            data_hora: ag.data_hora,
            tempo_servico: servico?.tempo_medio || 30,
          };
        }),
      );
      setAgendamentosExistentes(agendamentosComTempo);
    } else {
      setAgendamentosExistentes([]);
    }
  };

  useEffect(() => {
    if (selectedDate && configuracoes) {
      generateHorariosDisponiveis();
    }
  }, [selectedDate, configuracoes, agendamentosExistentes, tempoServico]);

  const INTERVALO_ENTRE_AGENDAMENTOS = 5; // minutos de folga entre agendamentos

  const generateHorariosDisponiveis = () => {
    if (!configuracoes || !selectedDate) return;

    const horarios: string[] = [];
    const agora = new Date();
    const limiteAntecedencia = addMinutes(agora, 90);
    const dataEscolhida = startOfDay(selectedDate);
    const ehHoje = dataEscolhida.getTime() === startOfDay(agora).getTime();
    const tempoComIntervalo = tempoServico + INTERVALO_ENTRE_AGENDAMENTOS;

    // Parse horários de funcionamento
    const [horaAbertura, minAbertura] = configuracoes.horario_abertura
      .split(":")
      .map(Number);
    const [horaFechamento, minFechamento] = configuracoes.horario_fechamento
      .split(":")
      .map(Number);

    let horarioAtual = setMinutes(
      setHours(selectedDate, horaAbertura),
      minAbertura,
    );
    const horarioFim = setMinutes(
      setHours(selectedDate, horaFechamento),
      minFechamento,
    );

    // Horário de almoço (se existir)
    let almocoInicio: Date | null = null;
    let almocoFim: Date | null = null;

    if (
      configuracoes.horario_almoco_inicio &&
      configuracoes.horario_almoco_fim
    ) {
      const [horaAlmocoIni, minAlmocoIni] = configuracoes.horario_almoco_inicio
        .split(":")
        .map(Number);
      const [horaAlmocoFim, minAlmocoFim] = configuracoes.horario_almoco_fim
        .split(":")
        .map(Number);
      almocoInicio = setMinutes(
        setHours(selectedDate, horaAlmocoIni),
        minAlmocoIni,
      );
      almocoFim = setMinutes(
        setHours(selectedDate, horaAlmocoFim),
        minAlmocoFim,
      );
    }

    while (horarioAtual < horarioFim) {
      const horarioStr = format(horarioAtual, "HH:mm");
      const fimSlot = addMinutes(horarioAtual, tempoServico);

      // Verifica se o slot se sobrepõe ao horário de almoço (qualquer interseção bloqueia)
      const ehHorarioAlmoco =
        almocoInicio &&
        almocoFim &&
        horarioAtual < almocoFim &&
        fimSlot > almocoInicio;

      // Bloqueia se o slot ultrapassar o horário de fechamento
      const ultrapassaFechamento = fimSlot > horarioFim;

      // Se for hoje, só mostrar horários futuros
      const ehHorarioBloqueado = ehHoje && horarioAtual < limiteAntecedencia;

      // Verifica se já tem agendamento neste horário (considerando duração + intervalo de folga)
      const temAgendamento = agendamentosExistentes.some((ag) => {
        const dataAgendamento = new Date(ag.data_hora);
        const fimAgendamento = addMinutes(
          dataAgendamento,
          ag.tempo_servico + INTERVALO_ENTRE_AGENDAMENTOS,
        );

        // Verifica se há sobreposição entre o slot novo e o agendamento existente (incluindo intervalo)
        return horarioAtual < fimAgendamento && fimSlot > dataAgendamento;
      });

      if (
        !ehHorarioAlmoco &&
        !ehHorarioBloqueado &&
        !temAgendamento &&
        !ultrapassaFechamento
      ) {
        horarios.push(horarioStr);
      }

      horarioAtual = addMinutes(horarioAtual, tempoComIntervalo);
    }

    setHorariosDisponiveis(horarios);
  };

  const isDiaFuncionamento = (date: Date) => {
    if (!configuracoes) return true;

    const diasSemana = [
      "domingo",
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
    ];
    const diaSemana = diasSemana[date.getDay()];

    return configuracoes.dias_funcionamento?.includes(diaSemana) ?? true;
  };

  const disabledDays = (date: Date) => {
    // Desabilita datas passadas
    if (isBefore(date, startOfDay(new Date()))) {
      return true;
    }

    // Desabilita dias que não são de funcionamento
    return !isDiaFuncionamento(date);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Data</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal ",
                !selectedDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate
                ? format(selectedDate, "PPP", { locale: ptBR })
                : "Selecione a data"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onDateChange}
              disabled={disabledDays}
              initialFocus
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {selectedDate && funcionarioId && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horários Disponíveis
          </Label>
          {horariosDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
              Nenhum horário disponível para esta data
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {horariosDisponiveis.map((horario) => (
                <Button
                  key={horario}
                  type="button"
                  variant={selectedTime === horario ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTimeChange(horario)}
                  className="transition-smooth"
                >
                  {horario}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {!funcionarioId && selectedDate && (
        <p className="text-sm text-muted-foreground">
          Selecione um profissional para ver os horários disponíveis
        </p>
      )}
    </div>
  );
}
