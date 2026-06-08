-- Habilitar RLS em todas as tabelas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Criar políticas para permitir acesso público (temporário até implementar autenticação)
-- Políticas para clientes
CREATE POLICY "Permitir acesso a clientes" ON public.clientes FOR ALL USING (true);

-- Políticas para serviços
CREATE POLICY "Permitir acesso a servicos" ON public.servicos FOR ALL USING (true);

-- Políticas para agendamentos
CREATE POLICY "Permitir acesso a agendamentos" ON public.agendamentos FOR ALL USING (true);

-- Corrigir a função update_updated_at_column para ter search_path fixo
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;