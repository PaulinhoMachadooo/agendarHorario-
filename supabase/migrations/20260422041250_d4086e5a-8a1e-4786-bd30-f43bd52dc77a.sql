-- servicos.tempo_medio
ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS tempo_medio INTEGER NOT NULL DEFAULT 30;

-- clientes.user_id
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- agendamentos.forma_pagamento
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- configuracoes_barbearia (singleton)
CREATE TABLE IF NOT EXISTS public.configuracoes_barbearia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT 'Minha Barbearia',
  endereco TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  horario_abertura TEXT NOT NULL DEFAULT '09:00',
  horario_fechamento TEXT NOT NULL DEFAULT '19:00',
  dias_funcionamento TEXT[] NOT NULL DEFAULT ARRAY['segunda','terca','quarta','quinta','sexta','sabado'],
  intervalo_agendamento INTEGER NOT NULL DEFAULT 30,
  logo_url TEXT NOT NULL DEFAULT '',
  cor_primaria TEXT NOT NULL DEFAULT '#1f2937',
  cor_secundaria TEXT NOT NULL DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracoes_barbearia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ver configuracoes" ON public.configuracoes_barbearia FOR SELECT USING (true);
CREATE POLICY "Autenticados podem inserir configuracoes" ON public.configuracoes_barbearia FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar configuracoes" ON public.configuracoes_barbearia FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER trg_configuracoes_updated_at BEFORE UPDATE ON public.configuracoes_barbearia FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Linha inicial padrão
INSERT INTO public.configuracoes_barbearia (nome) VALUES ('Minha Barbearia') ON CONFLICT DO NOTHING;