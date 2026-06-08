-- Corrigir RLS policies para transacoes_financeiras permitir inserção pelo trigger
-- Primeiro, remover a política restritiva atual
DROP POLICY IF EXISTS "Restrict INSERT/UPDATE/DELETE on transacoes_financeiras" ON public.transacoes_financeiras;

-- Permitir INSERT via trigger (sistema) para transações financeiras
CREATE POLICY "Allow system insert for transacoes_financeiras" 
ON public.transacoes_financeiras 
FOR INSERT 
WITH CHECK (true);

-- Manter as políticas de SELECT existentes
-- Admin pode ver todas as transações já está definida
-- Funcionários podem ver suas transações já está definida

-- Adicionar trigger para agendamentos se não existir
DROP TRIGGER IF EXISTS trigger_calcular_comissao ON public.agendamentos;

CREATE TRIGGER trigger_calcular_comissao
  AFTER UPDATE ON public.agendamentos
  FOR EACH ROW 
  EXECUTE FUNCTION public.calcular_comissao();