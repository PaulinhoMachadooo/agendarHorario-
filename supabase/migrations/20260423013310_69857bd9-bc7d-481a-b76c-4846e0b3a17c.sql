-- Permitir que clientes autenticados vejam funcionários ativos (necessário para escolher profissional ao agendar)
DROP POLICY IF EXISTS "Equipe ve funcionarios" ON public.funcionarios;

CREATE POLICY "Ver funcionarios autenticados"
ON public.funcionarios
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'colaborador'::app_role)
  OR (has_role(auth.uid(), 'cliente'::app_role) AND ativo = true)
);