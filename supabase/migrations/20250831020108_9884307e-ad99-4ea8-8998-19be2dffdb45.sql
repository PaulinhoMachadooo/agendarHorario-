-- Criar enums necessários
CREATE TYPE public.cargo_funcionario AS ENUM ('barbeiro', 'recepcao', 'auxiliar');
CREATE TYPE public.nivel_acesso AS ENUM ('funcionario', 'administrador');
CREATE TYPE public.tipo_comissao AS ENUM ('percentual', 'fixo');

-- Tabela de funcionários
CREATE TABLE public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cargo cargo_funcionario NOT NULL,
  nivel_acesso nivel_acesso NOT NULL DEFAULT 'funcionario',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de comissões
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_comissao tipo_comissao NOT NULL,
  valor NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações da barbearia
CREATE TABLE public.configuracoes_barbearia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT 'Barbearia Estrela',
  endereco TEXT,
  telefone TEXT,
  horario_abertura TIME NOT NULL DEFAULT '08:00',
  horario_fechamento TIME NOT NULL DEFAULT '18:00',
  logo_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações financeiras
CREATE TABLE public.transacoes_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  valor_servico NUMERIC NOT NULL,
  valor_comissao NUMERIC NOT NULL,
  valor_barbearia NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar funcionario_id na tabela agendamentos
ALTER TABLE public.agendamentos ADD COLUMN funcionario_id UUID REFERENCES public.funcionarios(id);

-- Inserir configuração inicial da barbearia
INSERT INTO public.configuracoes_barbearia (nome, endereco, telefone) 
VALUES ('Barbearia Estrela', 'Rua das Estrelas, 123', '(11) 99999-9999');

-- Enable RLS em todas as tabelas
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_barbearia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

-- Políticas para funcionarios
CREATE POLICY "Administradores podem ver todos os funcionários" 
ON public.funcionarios FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios f 
    WHERE f.user_id = auth.uid() AND f.nivel_acesso = 'administrador' AND f.ativo = true
  )
);

CREATE POLICY "Funcionários podem ver seus próprios dados" 
ON public.funcionarios FOR SELECT 
USING (user_id = auth.uid());

-- Políticas para comissoes
CREATE POLICY "Administradores podem gerenciar comissões" 
ON public.comissoes FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios f 
    WHERE f.user_id = auth.uid() AND f.nivel_acesso = 'administrador' AND f.ativo = true
  )
);

CREATE POLICY "Funcionários podem ver suas comissões" 
ON public.comissoes FOR SELECT 
USING (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
  )
);

-- Políticas para configurações (apenas admins)
CREATE POLICY "Apenas administradores podem gerenciar configurações" 
ON public.configuracoes_barbearia FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios f 
    WHERE f.user_id = auth.uid() AND f.nivel_acesso = 'administrador' AND f.ativo = true
  )
);

-- Políticas para transações financeiras
CREATE POLICY "Administradores podem ver todas as transações" 
ON public.transacoes_financeiras FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios f 
    WHERE f.user_id = auth.uid() AND f.nivel_acesso = 'administrador' AND f.ativo = true
  )
);

CREATE POLICY "Funcionários podem ver suas transações" 
ON public.transacoes_financeiras FOR SELECT 
USING (
  funcionario_id IN (
    SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
  )
);

-- Triggers para updated_at
CREATE TRIGGER update_funcionarios_updated_at
  BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comissoes_updated_at
  BEFORE UPDATE ON public.comissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes_barbearia
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular comissões automaticamente
CREATE OR REPLACE FUNCTION public.calcular_comissao()
RETURNS TRIGGER AS $$
DECLARE
  servico_preco NUMERIC;
  comissao_config RECORD;
  valor_comissao NUMERIC;
  valor_barbearia NUMERIC;
BEGIN
  -- Só calcular quando status mudar para 'concluido'
  IF NEW.status = 'concluido' AND OLD.status != 'concluido' THEN
    -- Buscar preço do serviço
    SELECT preco INTO servico_preco 
    FROM public.servicos 
    WHERE id = NEW.servico_id;
    
    -- Buscar configuração de comissão do funcionário
    SELECT tipo_comissao, valor INTO comissao_config
    FROM public.comissoes c
    JOIN public.funcionarios f ON c.funcionario_id = f.id
    WHERE f.id = NEW.funcionario_id
    ORDER BY c.created_at DESC
    LIMIT 1;
    
    -- Calcular comissão
    IF comissao_config.tipo_comissao = 'percentual' THEN
      valor_comissao := servico_preco * (comissao_config.valor / 100);
    ELSE
      valor_comissao := comissao_config.valor;
    END IF;
    
    valor_barbearia := servico_preco - valor_comissao;
    
    -- Inserir transação financeira
    INSERT INTO public.transacoes_financeiras (
      agendamento_id, funcionario_id, valor_servico, valor_comissao, valor_barbearia
    ) VALUES (
      NEW.id, NEW.funcionario_id, servico_preco, valor_comissao, valor_barbearia
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular comissões
CREATE TRIGGER trigger_calcular_comissao
  AFTER UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_comissao();