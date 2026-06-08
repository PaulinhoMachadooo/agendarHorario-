-- Função utilitária para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Enums
CREATE TYPE public.cargo_funcionario AS ENUM ('barbeiro', 'recepcionista', 'gerente', 'administrador');
CREATE TYPE public.nivel_acesso AS ENUM ('administrador', 'colaborador');
CREATE TYPE public.status_agendamento AS ENUM ('pendente', 'confirmado', 'concluido', 'cancelado');

-- SERVICOS
CREATE TABLE public.servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  duracao_minutos INTEGER NOT NULL DEFAULT 30,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados podem ver servicos" ON public.servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir servicos" ON public.servicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar servicos" ON public.servicos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir servicos" ON public.servicos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_servicos_updated_at BEFORE UPDATE ON public.servicos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CLIENTES
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados podem ver clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir clientes" ON public.clientes FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FUNCIONARIOS
CREATE TABLE public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  cargo public.cargo_funcionario NOT NULL DEFAULT 'barbeiro',
  nivel_acesso public.nivel_acesso NOT NULL DEFAULT 'colaborador',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados podem ver funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir funcionarios" ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar funcionarios" ON public.funcionarios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir funcionarios" ON public.funcionarios FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_funcionarios_updated_at BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AGENDAMENTOS
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE RESTRICT,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER NOT NULL DEFAULT 30,
  status public.status_agendamento NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agendamentos_data_hora ON public.agendamentos(data_hora);
CREATE INDEX idx_agendamentos_funcionario ON public.agendamentos(funcionario_id);
CREATE INDEX idx_agendamentos_cliente ON public.agendamentos(cliente_id);
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados podem ver agendamentos" ON public.agendamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir agendamentos" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar agendamentos" ON public.agendamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir agendamentos" ON public.agendamentos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_agendamentos_updated_at BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();