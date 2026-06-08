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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const CARGOS_VALIDOS = ["barbeiro", "recepcionista", "gerente", "administrador", "tosadora"] as const;
const NIVEIS_VALIDOS = ["colaborador", "administrador"] as const;
const TIPOS_COMISSAO = ["percentual", "fixo"] as const;

const funcionarioBaseSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  telefone: z.string().trim().min(1, "Telefone é obrigatório").max(20, "Telefone muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  cargo: z.enum(CARGOS_VALIDOS, {
    errorMap: () => ({ message: `Cargo inválido. Use: ${CARGOS_VALIDOS.join(", ")}` }),
  }),
  nivel_acesso: z.enum(NIVEIS_VALIDOS, {
    errorMap: () => ({ message: `Nível inválido. Use: ${NIVEIS_VALIDOS.join(", ")}` }),
  }),
  tipo_comissao: z.enum(TIPOS_COMISSAO),
  valor_comissao: z.coerce.number().min(0, "Valor não pode ser negativo"),
});

const funcionarioCreateSchema = funcionarioBaseSchema.extend({
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72, "Senha muito longa"),
});

const funcionarioEditSchema = funcionarioBaseSchema.extend({
  senha: z.string().optional(),
});

interface Funcionario {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  cargo: string;
  nivel_acesso: string;
  ativo: boolean;
  created_at: string;
}

interface Comissao {
  id: string;
  funcionario_id: string;
  tipo_comissao: string;
  valor: number;
}

export default function Funcionarios() {
  const { toast } = useToast();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: "",
    senha: "",
    cargo: "barbeiro",
    nivel_acesso: "colaborador",
    tipo_comissao: "percentual",
    valor_comissao: 0,
  });


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [funcionariosResult, comissoesResult] = await Promise.all([
        supabase
          .from("funcionarios")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("comissoes").select("*"),
      ]);

      if (funcionariosResult.error) throw funcionariosResult.error;
      if (comissoesResult.error) throw comissoesResult.error;

      setFuncionarios(funcionariosResult.data || []);
      setComissoes(comissoesResult.data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredFuncionarios = funcionarios.filter(
    (funcionario) =>
      funcionario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      funcionario.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getComissao = (funcionarioId: string) => {
    return comissoes.find((c) => c.funcionario_id === funcionarioId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const schema = editingId ? funcionarioEditSchema : funcionarioCreateSchema;
    const result = schema.safeParse(formData);

    if (!result.success) {
      const firstError = result.error.errors[0];
      toast({
        title: "Erro de validação",
        description: firstError?.message ?? "Dados inválidos.",
        variant: "destructive",
      });
      return;
    }

    const data = result.data;

    try {
      if (editingId) {
        // Atualizar funcionário
        const { error: funcionarioError } = await supabase
          .from("funcionarios")
          .update({
            nome: formData.nome,
            telefone: formData.telefone,
            email: formData.email,
            cargo: formData.cargo as any,
            nivel_acesso: formData.nivel_acesso as any,
          })
          .eq("id", editingId);

        if (funcionarioError) throw funcionarioError;

        // Atualizar comissão
        const existingComissao = getComissao(editingId);
        if (existingComissao) {
          const { error: comissaoError } = await supabase
            .from("comissoes")
            .update({
              tipo_comissao: formData.tipo_comissao as any,
              valor: formData.valor_comissao,
            })
            .eq("funcionario_id", editingId);

          if (comissaoError) throw comissaoError;
        } else {
          const { error: comissaoError } = await supabase
            .from("comissoes")
            .insert([
              {
                funcionario_id: editingId,
                tipo_comissao: formData.tipo_comissao as any,
                valor: formData.valor_comissao,
              },
            ]);

          if (comissaoError) throw comissaoError;
        }
      } else {
        // Criar usuário no Supabase Auth primeiro
        const { data: authData, error: authError } = await supabase.auth.signUp(
          {
            email: formData.email,
            password: formData.senha,
            options: {
              emailRedirectTo: `${window.location.origin}/`,
              data: {
                nome: formData.nome,
                cargo: formData.cargo,
                nivel_acesso: formData.nivel_acesso,
              },
            },
          },
        );

        if (authError) throw authError;

        // Se o usuário foi criado com sucesso, criar o funcionário
        if (authData.user) {
          const { data: funcionarioData, error: funcionarioError } =
            await supabase
              .from("funcionarios")
              .insert([
                {
                  user_id: authData.user.id,
                  nome: formData.nome,
                  telefone: formData.telefone,
                  email: formData.email,
                  cargo: formData.cargo as any,
                  nivel_acesso: formData.nivel_acesso as any,
                },
              ])
              .select()
              .single();

          if (funcionarioError) throw funcionarioError;

          // Criar comissão
          const { error: comissaoError } = await supabase
            .from("comissoes")
            .insert([
              {
                funcionario_id: funcionarioData.id,
                tipo_comissao: formData.tipo_comissao as any,
                valor: formData.valor_comissao,
              },
            ]);

          if (comissaoError) throw comissaoError;
        }
      }

      await fetchData();
      resetForm();
      toast({
        title: editingId ? "Funcionário atualizado" : "Funcionário criado",
        description: "Operação realizada com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (funcionario: Funcionario) => {
    const comissao = getComissao(funcionario.id);
    setFormData({
      nome: funcionario.nome,
      telefone: funcionario.telefone,
      email: funcionario.email,
      senha: "", // Campo senha não é necessário na edição
      cargo: funcionario.cargo,
      nivel_acesso: funcionario.nivel_acesso,
      tipo_comissao: comissao?.tipo_comissao || "percentual",
      valor_comissao: comissao?.valor || 0,
    });
    setEditingId(funcionario.id);
    setIsDialogOpen(true);
  };

  const handleToggleAtivo = async (funcionario: Funcionario) => {
    try {
      const { error } = await supabase
        .from("funcionarios")
        .update({ ativo: !funcionario.ativo })
        .eq("id", funcionario.id);

      if (error) throw error;

      await fetchData();
      toast({
        title: "Status atualizado",
        description: `Funcionário ${funcionario.ativo ? "desativado" : "ativado"} com sucesso!`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: "",
      telefone: "",
      email: "",
      senha: "",
      cargo: "barbeiro",
      nivel_acesso: "colaborador",
      tipo_comissao: "percentual",
      valor_comissao: 0,
    });
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const getCargoLabel = (cargo: string) => {
    const labels: Record<string, string> = {
      barbeiro: "Barbeiro",
      recepcionista: "Recepcionista",
      gerente: "Gerente",
      administrador: "Administrador",
      tosadora: "Tosadora",
    };
    return labels[cargo] || cargo;
  };

  const getNivelLabel = (nivel: string) => {
    return nivel === "administrador" ? "Administrador" : "Colaborador";
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gerencie os funcionários do estabelecimento!
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Funcionário" : "Novo Funcionário"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, nome: e.target.value }))
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
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

                {!editingId && (
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha</Label>
                    <Input
                      id="senha"
                      type="password"
                      value={formData.senha}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          senha: e.target.value,
                        }))
                      }
                      required
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Select
                    value={formData.cargo}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, cargo: value }))
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="barbeiro">Barbeiro</SelectItem>
                      <SelectItem value="recepcionista">Recepcionista</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="administrador">Administrador</SelectItem>
                      <SelectItem value="tosadora">Tosadora</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nivel_acesso">Nível de Acesso</Label>
                  <Select
                    value={formData.nivel_acesso}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, nivel_acesso: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="administrador">
                        Administrador
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-4">Configuração de Comissão</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_comissao">Tipo de Comissão</Label>
                    <Select
                      value={formData.tipo_comissao}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          tipo_comissao: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentual">
                          Percentual (%)
                        </SelectItem>
                        <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valor_comissao">
                      Valor{" "}
                      {formData.tipo_comissao === "percentual" ? "(%)" : "(R$)"}
                    </Label>
                    <Input
                      id="valor_comissao"
                      type="number"
                      step="0.01"
                      value={formData.valor_comissao}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          valor_comissao: parseFloat(e.target.value) || 0,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Users className="h-5 w-5" />
            Lista de Funcionários
          </CardTitle>
          <CardDescription>
            {funcionarios.length} funcionário(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input placeholder="Buscar por nome ou email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:max-w-sm" />
          </div>

          {/* Mobile card view */}
          <div className="space-y-3 md:hidden">
            {filteredFuncionarios.map((funcionario) => {
              const comissao = getComissao(funcionario.id);
              return (
                <div key={funcionario.id} className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{funcionario.nome}</p>
                      <p className="text-sm text-muted-foreground">{funcionario.email}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(funcionario)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{getCargoLabel(funcionario.cargo)}</Badge>
                    <Badge variant={funcionario.nivel_acesso === "administrador" ? "default" : "secondary"}>
                      {getNivelLabel(funcionario.nivel_acesso)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Comissão: {comissao ? (comissao.tipo_comissao === "percentual" ? `${comissao.valor}%` : `R$ ${Number(comissao.valor).toFixed(2)}`) : "Não configurada"}
                    </span>
                    <div className="flex items-center space-x-2">
                      <Switch checked={funcionario.ativo} onCheckedChange={() => handleToggleAtivo(funcionario)} />
                      <span className={funcionario.ativo ? "text-green-600" : "text-red-600"}>
                        {funcionario.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFuncionarios.map((funcionario) => {
                  const comissao = getComissao(funcionario.id);
                  return (
                    <TableRow key={funcionario.id}>
                      <TableCell className="font-medium">{funcionario.nome}</TableCell>
                      <TableCell>{funcionario.email}</TableCell>
                      <TableCell><Badge variant="outline">{getCargoLabel(funcionario.cargo)}</Badge></TableCell>
                      <TableCell><Badge variant={funcionario.nivel_acesso === "administrador" ? "default" : "secondary"}>{getNivelLabel(funcionario.nivel_acesso)}</Badge></TableCell>
                      <TableCell>{comissao ? (comissao.tipo_comissao === "percentual" ? `${comissao.valor}%` : `R$ ${Number(comissao.valor).toFixed(2)}`) : <span className="text-muted-foreground">Não configurada</span>}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch checked={funcionario.ativo} onCheckedChange={() => handleToggleAtivo(funcionario)} />
                          <span className={funcionario.ativo ? "text-green-600" : "text-red-600"}>{funcionario.ativo ? "Ativo" : "Inativo"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(funcionario)}><Edit2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
