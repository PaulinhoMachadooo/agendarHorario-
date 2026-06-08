
-- Tabela de configurações da barbearia
CREATE TABLE public.configuracoes_barbearia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT 'Minha Barbearia',
  endereco TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  horario_abertura TEXT NOT NULL DEFAULT '08:00',
  horario_fechamento TEXT NOT NULL DEFAULT '18:00',
  horario_almoco_inicio TEXT,
  horario_almoco_fim TEXT,
  dias_funcionamento TEXT[] NOT NULL DEFAULT ARRAY['segunda','terca','quarta','quinta','sexta','sabado'],
  logo_url TEXT NOT NULL DEFAULT '',
  banner_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  data_cadastro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ultima_visita TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de serviços
CREATE TABLE public.servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  tempo_medio INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de funcionários
CREATE TABLE public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT 'barbeiro',
  nivel_acesso TEXT NOT NULL DEFAULT 'funcionario',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de agendamentos
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  servico_id UUID REFERENCES public.servicos(id) ON DELETE CASCADE NOT NULL,
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  funcionario TEXT NOT NULL DEFAULT '',
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de comissões
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE CASCADE NOT NULL,
  tipo_comissao TEXT NOT NULL DEFAULT 'percentual',
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações financeiras
CREATE TABLE public.transacoes_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  funcionario_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  valor_servico NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_comissao NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.configuracoes_barbearia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

-- Políticas para configuracoes_barbearia (leitura pública, escrita para autenticados)
CREATE POLICY "Configurações visíveis para todos" ON public.configuracoes_barbearia FOR SELECT USING (true);
CREATE POLICY "Autenticados podem atualizar configurações" ON public.configuracoes_barbearia FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Políticas para clientes (leitura/escrita pública para agendamento público)
CREATE POLICY "Clientes visíveis para todos" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode criar cliente" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar clientes" ON public.clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem deletar clientes" ON public.clientes FOR DELETE TO authenticated USING (true);

-- Políticas para serviços (leitura pública, escrita para autenticados)
CREATE POLICY "Serviços visíveis para todos" ON public.servicos FOR SELECT USING (true);
CREATE POLICY "Autenticados podem criar serviços" ON public.servicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar serviços" ON public.servicos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem deletar serviços" ON public.servicos FOR DELETE TO authenticated USING (true);

-- Políticas para funcionários (leitura pública para mostrar barbeiros, escrita para autenticados)
CREATE POLICY "Funcionários visíveis para todos" ON public.funcionarios FOR SELECT USING (true);
CREATE POLICY "Autenticados podem criar funcionários" ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar funcionários" ON public.funcionarios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem deletar funcionários" ON public.funcionarios FOR DELETE TO authenticated USING (true);

-- Políticas para agendamentos (leitura/escrita pública para agendamento público)
CREATE POLICY "Agendamentos visíveis para todos" ON public.agendamentos FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode criar agendamento" ON public.agendamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar agendamentos" ON public.agendamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem deletar agendamentos" ON public.agendamentos FOR DELETE TO authenticated USING (true);

-- Políticas para comissões (somente autenticados)
CREATE POLICY "Autenticados podem ver comissões" ON public.comissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem criar comissões" ON public.comissoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar comissões" ON public.comissoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados podem deletar comissões" ON public.comissoes FOR DELETE TO authenticated USING (true);

-- Políticas para transações financeiras (somente autenticados)
CREATE POLICY "Autenticados podem ver transações" ON public.transacoes_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem criar transações" ON public.transacoes_financeiras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar transações" ON public.transacoes_financeiras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Habilitar realtime para agendamentos
ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.servicos;

-- Inserir configuração padrão da barbearia
INSERT INTO public.configuracoes_barbearia (nome, endereco, telefone, horario_abertura, horario_fechamento, dias_funcionamento)
VALUES ('Minha Barbearia', '', '', '08:00', '18:00', ARRAY['segunda','terca','quarta','quinta','sexta','sabado']);
