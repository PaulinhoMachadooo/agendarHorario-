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
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  data_cadastro: string;
  ultima_visita: string | null;
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
  });

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("data_cadastro", { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const filteredClientes = clientes.filter(
    (cliente) =>
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.telefone.includes(searchTerm),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCliente) {
        // Editar cliente existente
        const { error } = await supabase
          .from("clientes")
          .update({
            nome: formData.nome,
            telefone: formData.telefone,
          })
          .eq("id", editingCliente.id);

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        // Adicionar novo cliente
        const { error } = await supabase.from("clientes").insert([
          {
            nome: formData.nome,
            telefone: formData.telefone,
            email: "", // Email vazio por padrão
          },
        ]);

        if (error) throw error;
        toast.success("Cliente cadastrado com sucesso!");
      }

      fetchClientes(); // Recarregar lista
      resetForm();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      toast.error("Erro ao salvar cliente");
    }
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      telefone: cliente.telefone,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", id);

      if (error) throw error;

      setClientes((prev) => prev.filter((cliente) => cliente.id !== id));
      toast.success("Cliente removido com sucesso!");
    } catch (error) {
      console.error("Erro ao remover cliente:", error);
      toast.error("Erro ao remover cliente");
    }
  };

  const resetForm = () => {
    setFormData({ nome: "", telefone: "" });
    setEditingCliente(null);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1 md:mb-2">Clientes</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gerencie todos os clientes</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[hsl(340,80%,55%)] hover:bg-[hsl(340,80%,45%)] text-white shadow-violet transition-smooth w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="gradient-card border-border w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingCliente ? "Editar Cliente" : "Novo Cliente"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome" className="text-foreground">Nome</Label>
                <Input id="nome" value={formData.nome} onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))} className="bg-input border-border text-foreground" required />
              </div>
              <div>
                <Label htmlFor="telefone" className="text-foreground">Telefone</Label>
                <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData((prev) => ({ ...prev, telefone: e.target.value }))} className="bg-input border-border text-foreground" required />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1 bg-[hsl(340,80%,55%)] hover:bg-[hsl(340,80%,45%)] text-white">
                  {editingCliente ? "Atualizar" : "Cadastrar"}
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
              <Users className="w-5 h-5 text-primary" />
              Lista de Clientes
            </CardTitle>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar clientes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full md:w-72 bg-input border-border" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile card view */}
          <div className="space-y-3 md:hidden">
            {filteredClientes.map((cliente) => (
              <div key={cliente.id} className="p-4 rounded-lg bg-secondary/30 border border-border space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{cliente.nome}</p>
                    <p className="text-sm text-muted-foreground">{cliente.telefone}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)} className="h-8 w-8 p-0">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(cliente.id)} className="h-8 w-8 p-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Cadastro: {new Date(cliente.data_cadastro).toLocaleDateString("pt-BR")}</span>
                  <span>Última visita: {cliente.ultima_visita ? new Date(cliente.ultima_visita).toLocaleDateString("pt-BR") : "Nunca"}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Nome</TableHead>
                  <TableHead className="text-muted-foreground">Telefone</TableHead>
                  <TableHead className="text-muted-foreground">Data Cadastro</TableHead>
                  <TableHead className="text-muted-foreground">Última Visita</TableHead>
                  <TableHead className="text-muted-foreground text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.map((cliente) => (
                  <TableRow key={cliente.id} className="border-border hover:bg-secondary/20 transition-smooth">
                    <TableCell className="font-medium text-foreground">{cliente.nome}</TableCell>
                    <TableCell className="text-foreground">{cliente.telefone}</TableCell>
                    <TableCell className="text-foreground">{new Date(cliente.data_cadastro).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-foreground">{cliente.ultima_visita ? new Date(cliente.ultima_visita).toLocaleDateString("pt-BR") : "Nunca"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)} className="h-8 w-8 p-0"><Pencil className="w-4 h-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(cliente.id)} className="h-8 w-8 p-0"><Trash2 className="w-4 h-4" /></Button>
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
