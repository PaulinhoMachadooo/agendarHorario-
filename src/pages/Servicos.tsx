import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, Search, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Servico = {
  id: string;
  nome: string;
  preco: number;
  tempo_medio: number;
};

export default function Servicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    nome: "",
    preco: "",
    tempoMedio: "",
  });

  useEffect(() => {
    fetchServicos();
  }, []);

  const fetchServicos = async () => {
    try {
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      setServicos(data || []);
    } catch (error) {
      console.error("Erro ao carregar serviços:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  const filteredServicos = servicos.filter((servico) =>
    servico.nome.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingServico) {
        // Editar serviço existente
        const { error } = await supabase
          .from("servicos")
          .update({
            nome: formData.nome,
            preco: parseFloat(formData.preco),
            tempo_medio: parseInt(formData.tempoMedio),
          })
          .eq("id", editingServico.id);

        if (error) throw error;
        toast.success("Serviço atualizado com sucesso!");
      } else {
        // Adicionar novo serviço
        const { error } = await supabase.from("servicos").insert([
          {
            nome: formData.nome,
            preco: parseFloat(formData.preco),
            tempo_medio: parseInt(formData.tempoMedio),
          },
        ]);

        if (error) throw error;
        toast.success("Serviço cadastrado com sucesso!");
      }

      fetchServicos(); // Recarregar lista
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar serviço:", error);
      toast.error("Erro ao salvar serviço");
    }
  };

  const handleEdit = (servico: Servico) => {
    setEditingServico(servico);
    setFormData({
      nome: servico.nome,
      preco: servico.preco.toString(),
      tempoMedio: servico.tempo_medio.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("servicos").delete().eq("id", id);

      if (error) throw error;

      setServicos((prev) => prev.filter((servico) => servico.id !== id));
      toast.success("Serviço removido com sucesso!");
    } catch (error) {
      console.error("Erro ao remover serviço:", error);
      toast.error("Erro ao remover serviço");
    }
  };

  const resetForm = () => {
    setFormData({ nome: "", preco: "", tempoMedio: "" });
    setEditingServico(null);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">Serviços</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gerencie todos os serviços oferecidos!</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[hsl(340,80%,55%)] hover:bg-[hsl(340,80%,45%)] text-white shadow-violet transition-smooth w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="gradient-card border-border w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingServico ? "Editar Serviço" : "Novo Serviço"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome" className="text-foreground">Nome do Serviço</Label>
                <Input id="nome" value={formData.nome} onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))} className="bg-input border-border text-foreground" required />
              </div>
              <div>
                <Label htmlFor="preco" className="text-foreground">Preço (R$)</Label>
                <Input id="preco" type="number" step="0.01" min="0" value={formData.preco} onChange={(e) => setFormData((prev) => ({ ...prev, preco: e.target.value }))} className="bg-input border-border text-foreground" required />
              </div>
              <div>
                <Label htmlFor="tempoMedio" className="text-foreground">Tempo Médio (minutos)</Label>
                <Input id="tempoMedio" type="number" min="1" value={formData.tempoMedio} onChange={(e) => setFormData((prev) => ({ ...prev, tempoMedio: e.target.value }))} className="bg-input border-border text-foreground" required />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1 bg-[hsl(340,80%,55%)] hover:bg-[hsl(340,80%,45%)] text-white">
                  {editingServico ? "Atualizar" : "Cadastrar"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1">Cancelar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="gradient-card border-border shadow-elevated">
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3 md:gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-foreground flex items-center gap-2 text-base md:text-lg">
              <Scissors className="w-5 h-5 text-primary" />
              Lista de Serviços
            </CardTitle>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar serviços..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full md:w-72 bg-input border-border" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile card view */}
          <div className="space-y-3 md:hidden">
            {filteredServicos.map((servico) => (
              <div key={servico.id} className="p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{servico.nome}</p>
                    <p className="text-sm font-semibold text-primary mt-1">R$ {Number(servico.preco).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{servico.tempo_medio} min</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(servico)} className="h-8 w-8 p-0">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(servico.id)} className="h-8 w-8 p-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Nome do Serviço</TableHead>
                  <TableHead className="text-muted-foreground">Preço</TableHead>
                  <TableHead className="text-muted-foreground">Tempo Médio</TableHead>
                  <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServicos.map((servico) => (
                  <TableRow key={servico.id} className="border-border hover:bg-secondary/20 transition-smooth">
                    <TableCell className="font-medium text-foreground">{servico.nome}</TableCell>
                    <TableCell className="text-foreground font-semibold text-primary">R$ {Number(servico.preco).toFixed(2)}</TableCell>
                    <TableCell className="text-foreground">{servico.tempo_medio} min</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(servico)} className="h-8 w-8 p-0"><Pencil className="w-4 h-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(servico.id)} className="h-8 w-8 p-0"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
