-- 1. Estende enum status_agendamento
ALTER TYPE public.status_agendamento ADD VALUE IF NOT EXISTS 'agendado';
ALTER TYPE public.status_agendamento ADD VALUE IF NOT EXISTS 'quitado';

-- 2. clientes: data_cadastro / ultima_visita
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS ultima_visita TIMESTAMPTZ;

-- 3. configuracoes_barbearia: novos campos
ALTER TABLE public.configuracoes_barbearia ADD COLUMN IF NOT EXISTS horario_almoco_inicio TEXT NOT NULL DEFAULT '12:00';
ALTER TABLE public.configuracoes_barbearia ADD COLUMN IF NOT EXISTS horario_almoco_fim TEXT NOT NULL DEFAULT '13:00';
ALTER TABLE public.configuracoes_barbearia ADD COLUMN IF NOT EXISTS banner_url TEXT NOT NULL DEFAULT '';

-- 4. comissoes
CREATE TABLE IF NOT EXISTS public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_comissao TEXT NOT NULL DEFAULT 'percentual',
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados podem ver comissoes" ON public.comissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir comissoes" ON public.comissoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar comissoes" ON public.comissoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir comissoes" ON public.comissoes FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_comissoes_updated_at BEFORE UPDATE ON public.comissoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. transacoes_financeiras
CREATE TABLE IF NOT EXISTS public.transacoes_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'receita',
  descricao TEXT NOT NULL DEFAULT '',
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  forma_pagamento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados podem ver transacoes" ON public.transacoes_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir transacoes" ON public.transacoes_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar transacoes" ON public.transacoes_financeiras FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir transacoes" ON public.transacoes_financeiras FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_transacoes_updated_at BEFORE UPDATE ON public.transacoes_financeiras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();