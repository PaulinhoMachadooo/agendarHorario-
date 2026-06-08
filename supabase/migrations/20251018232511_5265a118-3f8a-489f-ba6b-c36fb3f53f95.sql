-- Adicionar política para permitir que clientes vejam funcionários ativos
CREATE POLICY "Clientes podem ver funcionários ativos"
ON public.funcionarios
FOR SELECT
USING (ativo = true);