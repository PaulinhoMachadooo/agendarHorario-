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
import { Separator } from "@/components/ui/separator";
import { Settings, Upload, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

interface ConfiguracoesBarbearia {
  id: string;
  nome: string;
  endereco: string;
  telefone: string;
  horario_abertura: string;
  horario_fechamento: string;
  dias_funcionamento: string[];
  horario_almoco_inicio: string;
  horario_almoco_fim: string;
  logo_url: string;
  banner_url: string;
}

export default function Configuracoes() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [configuracoes, setConfiguracoes] = useState<ConfiguracoesBarbearia>({
    id: "",
    nome: "",
    endereco: "",
    telefone: "",
    horario_abertura: "08:00",
    horario_fechamento: "18:00",
    dias_funcionamento: [
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
    ],
    horario_almoco_inicio: "12:00",
    horario_almoco_fim: "13:00",
    logo_url: "",
    banner_url: "",
  });

  useEffect(() => {
    fetchConfiguracoes();
  }, []);

  const fetchConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes_barbearia")
        .select("*")
        .single();

      if (error) throw error;

      if (data) {
        setConfiguracoes(data);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("configuracoes_barbearia")
        .update({
          nome: configuracoes.nome,
          endereco: configuracoes.endereco,
          telefone: configuracoes.telefone,
          horario_abertura: configuracoes.horario_abertura,
          horario_fechamento: configuracoes.horario_fechamento,
          dias_funcionamento: configuracoes.dias_funcionamento,
          horario_almoco_inicio: configuracoes.horario_almoco_inicio,
          horario_almoco_fim: configuracoes.horario_almoco_fim,
          logo_url: configuracoes.logo_url,
          banner_url: configuracoes.banner_url,
        })
        .eq("id", configuracoes.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    field: keyof ConfiguracoesBarbearia,
    value: string | string[],
  ) => {
    setConfiguracoes((prev) => ({ ...prev, [field]: value }));
  };

  const handleDiaToggle = (dia: string) => {
    const dias = configuracoes.dias_funcionamento || [];
    if (dias.includes(dia)) {
      handleInputChange(
        "dias_funcionamento",
        dias.filter((d) => d !== dia),
      );
    } else {
      handleInputChange("dias_funcionamento", [...dias, dia]);
    }
  };

  const diasSemana = [
    { value: "domingo", label: "Domingo" },
    { value: "segunda", label: "Segunda" },
    { value: "terca", label: "Terça" },
    { value: "quarta", label: "Quarta" },
    { value: "quinta", label: "Quinta" },
    { value: "sexta", label: "Sexta" },
    { value: "sabado", label: "Sábado" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie as informações!</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Informações do Estabelecimento
            </CardTitle>
            <CardDescription>
              Configure os dados básicos da seu estabelecimento!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Estabelecimento</Label>
                <Input
                  id="nome"
                  value={configuracoes.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  placeholder="Nome da sua barbearia"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={configuracoes.telefone}
                  onChange={(e) =>
                    handleInputChange("telefone", e.target.value)
                  }
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço Completo</Label>
              <Input
                id="endereco"
                value={configuracoes.endereco}
                onChange={(e) => handleInputChange("endereco", e.target.value)}
                placeholder="Rua, número, bairro, cidade - CEP"
                required
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Dias de Funcionamento</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {diasSemana.map((dia) => (
                  <div key={dia.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={dia.value}
                      checked={configuracoes.dias_funcionamento?.includes(
                        dia.value,
                      )}
                      onCheckedChange={() => handleDiaToggle(dia.value)}
                    />
                    <Label
                      htmlFor={dia.value}
                      className="cursor-pointer font-normal"
                    >
                      {dia.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horário de Funcionamento</CardTitle>
            <CardDescription>
              Defina os horários de abertura, fechamento e almoço
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="horario_abertura">Horário de Abertura</Label>
                <Input
                  id="horario_abertura"
                  type="time"
                  value={configuracoes.horario_abertura}
                  onChange={(e) =>
                    handleInputChange("horario_abertura", e.target.value)
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horario_fechamento">
                  Horário de Fechamento
                </Label>
                <Input
                  id="horario_fechamento"
                  type="time"
                  value={configuracoes.horario_fechamento}
                  onChange={(e) =>
                    handleInputChange("horario_fechamento", e.target.value)
                  }
                  required
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="horario_almoco_inicio">Início do Almoço</Label>
                <Input
                  id="horario_almoco_inicio"
                  type="time"
                  value={configuracoes.horario_almoco_inicio}
                  onChange={(e) =>
                    handleInputChange("horario_almoco_inicio", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horario_almoco_fim">Fim do Almoço</Label>
                <Input
                  id="horario_almoco_fim"
                  type="time"
                  value={configuracoes.horario_almoco_fim}
                  onChange={(e) =>
                    handleInputChange("horario_almoco_fim", e.target.value)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Imagens do Estabelecimento</CardTitle>
            <CardDescription>
              Configure o logo e banner que aparecerão na página pública
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">URL do Logo</Label>
              <div className="flex space-x-2">
                <Input
                  id="logo_url"
                  value={configuracoes.logo_url}
                  onChange={(e) =>
                    handleInputChange("logo_url", e.target.value)
                  }
                  placeholder="https://exemplo.com/logo.png"
                />
                <Button type="button" variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              {configuracoes.logo_url && (
                <div className="mt-2">
                  <img
                    src={configuracoes.logo_url}
                    alt="Logo"
                    className="h-16 w-auto object-contain border rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="banner_url">URL do Banner</Label>
              <div className="flex space-x-2">
                <Input
                  id="banner_url"
                  value={configuracoes.banner_url}
                  onChange={(e) =>
                    handleInputChange("banner_url", e.target.value)
                  }
                  placeholder="https://exemplo.com/banner.jpg"
                />
                <Button type="button" variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
              {configuracoes.banner_url && (
                <div className="mt-2">
                  <img
                    src={configuracoes.banner_url}
                    alt="Banner"
                    className="h-32 w-auto object-cover border rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </form>
    </div>
  );
}
