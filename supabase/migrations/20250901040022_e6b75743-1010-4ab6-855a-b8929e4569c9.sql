-- Corrigir a função update_updated_at_column para ter search_path seguro
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recriar triggers que foram removidos
CREATE TRIGGER update_funcionarios_updated_at
    BEFORE UPDATE ON public.funcionarios
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

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

CREATE TRIGGER update_comissoes_updated_at
    BEFORE UPDATE ON public.comissoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_barbearia_updated_at
    BEFORE UPDATE ON public.configuracoes_barbearia
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Recriar trigger para calcular comissão
CREATE TRIGGER trigger_calcular_comissao
    AFTER UPDATE ON public.agendamentos
    FOR EACH ROW
    EXECUTE FUNCTION public.calcular_comissao();

-- Melhorar as políticas RLS para funcionários
-- Permitir que administradores insiram novos funcionários
DROP POLICY IF EXISTS "Administradores podem ver todos os funcionários" ON public.funcionarios;

CREATE POLICY "Administradores podem gerenciar funcionários"
ON public.funcionarios
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios f 
    WHERE f.user_id = auth.uid() 
    AND f.nivel_acesso = 'administrador' 
    AND f.ativo = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.funcionarios f 
    WHERE f.user_id = auth.uid() 
    AND f.nivel_acesso = 'administrador' 
    AND f.ativo = true
  )
);

-- Política para permitir inserção inicial de funcionários (primeiro cadastro)
CREATE POLICY "Permitir inserção inicial de funcionários"
ON public.funcionarios
FOR INSERT
TO authenticated
WITH CHECK (
  -- Permitir se não há nenhum funcionário ainda (primeiro cadastro)
  NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE ativo = true)
  OR
  -- Ou se é um administrador cadastrando
  EXISTS (
    SELECT 1 FROM public.funcionarios f 
    WHERE f.user_id = auth.uid() 
    AND f.nivel_acesso = 'administrador' 
    AND f.ativo = true
  )
);