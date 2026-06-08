-- Criar tabela de clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  data_cadastro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ultima_visita TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de serviços
CREATE TABLE public.servicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  tempo_medio INTEGER NOT NULL, -- em minutos
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar enum para status de agendamento
CREATE TYPE public.status_agendamento AS ENUM ('agendado', 'concluido', 'cancelado');

-- Criar tabela de agendamentos
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  funcionario TEXT NOT NULL,
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.status_agendamento NOT NULL DEFAULT 'agendado',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers para atualizar timestamps automaticamente
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_servicos_updated_at
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX idx_agendamentos_cliente_id ON public.agendamentos(cliente_id);
CREATE INDEX idx_agendamentos_servico_id ON public.agendamentos(servico_id);
CREATE INDEX idx_agendamentos_data_hora ON public.agendamentos(data_hora);
CREATE INDEX idx_agendamentos_status ON public.agendamentos(status);
CREATE INDEX idx_clientes_email ON public.clientes(email);

-- Inserir alguns dados de exemplo
INSERT INTO public.clientes (nome, telefone, email, data_cadastro, ultima_visita) VALUES
  ('João Silva', '(11) 99999-1234', 'joao@email.com', '2024-01-15 10:00:00', '2024-08-20 14:30:00'),
  ('Maria Santos', '(11) 88888-5678', 'maria@email.com', '2024-02-20 15:30:00', '2024-08-22 10:00:00'),
  ('Pedro Oliveira', '(11) 77777-9012', 'pedro@email.com', '2024-03-10 09:15:00', '2024-08-25 16:45:00'),
  ('Ana Costa', '(11) 66666-3456', 'ana@email.com', '2024-04-05 11:45:00', '2024-08-28 09:30:00');

INSERT INTO public.servicos (nome, preco, tempo_medio) VALUES
  ('Corte Masculino', 25.00, 30),
  ('Barba', 15.00, 20),
  ('Corte + Barba', 35.00, 45),
  ('Sobrancelha', 10.00, 15),
  ('Corte Infantil', 20.00, 25);

-- Inserir alguns agendamentos de exemplo (usando IDs dos clientes e serviços criados)
INSERT INTO public.agendamentos (cliente_id, servico_id, funcionario, data_hora, status, observacoes)
SELECT 
  c.id,
  s.id,
  'Carlos',
  '2024-08-29 14:00:00',
  'agendado',
  'Cliente prefere corte social'
FROM public.clientes c, public.servicos s 
WHERE c.email = 'joao@email.com' AND s.nome = 'Corte Masculino'
LIMIT 1;

INSERT INTO public.agendamentos (cliente_id, servico_id, funcionario, data_hora, status, observacoes)
SELECT 
  c.id,
  s.id,
  'Roberto',
  '2024-08-29 15:30:00',
  'agendado',
  'Primeira vez no salão'
FROM public.clientes c, public.servicos s 
WHERE c.email = 'maria@email.com' AND s.nome = 'Corte + Barba'
LIMIT 1;