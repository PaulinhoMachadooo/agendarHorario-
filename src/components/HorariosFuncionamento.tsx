import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";

interface ConfiguracoesBarbearia {
  nome: string;
  horario_abertura: string;
  horario_fechamento: string;
  horario_almoco_inicio: string | null;
  horario_almoco_fim: string | null;
  dias_funcionamento: string[];
}

export function HorariosFuncionamento() {
  const [configuracoes, setConfiguracoes] =
    useState<ConfiguracoesBarbearia | null>(null);

  useEffect(() => {
    fetchConfiguracoes();
  }, []);

  const fetchConfiguracoes = async () => {
    const { data, error } = await supabase
      .from("configuracoes_barbearia")
      .select(
        "nome, horario_abertura, horario_fechamento, horario_almoco_inicio, horario_almoco_fim, dias_funcionamento",
      )
      .maybeSingle();

    if (!error && data) {
      setConfiguracoes(data);
    }
  };

  const diasSemanaMap: Record<string, string> = {
    domingo: "Dom",
    segunda: "Seg",
    terca: "Ter",
    quarta: "Qua",
    quinta: "Qui",
    sexta: "Sex",
    sabado: "Sáb",
  };

  const allDias = [
    "domingo",
    "segunda",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sabado",
  ];

  if (!configuracoes) {
    return null;
  }

  return (
    <Card className="gradient-card border-border shadow-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-primary" />
          Horário de Funcionamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Horário de Atendimento
              </span>
            </div>
            <span className="font-bold text-primary">
              {formatTime(configuracoes.horario_abertura)} às{" "}
              {formatTime(configuracoes.horario_fechamento)}
            </span>
          </div>

          {configuracoes.horario_almoco_inicio &&
            configuracoes.horario_almoco_fim && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Horário de Almoço</span>
                </div>
                <span className="font-bold text-muted-foreground">
                  {formatTime(configuracoes.horario_almoco_inicio)} às{" "}
                  {formatTime(configuracoes.horario_almoco_fim)}
                </span>
              </div>
            )}

          <div className="p-3 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Dias de Funcionamento</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {allDias.map((dia) => {
                const isOpen = configuracoes.dias_funcionamento?.includes(dia);
                return (
                  <Badge
                    key={dia}
                    variant={isOpen ? "default" : "outline"}
                    className={!isOpen ? "opacity-50" : ""}
                  >
                    {diasSemanaMap[dia]}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
