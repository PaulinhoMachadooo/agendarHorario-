DROP POLICY IF EXISTS "Atualizar agendamentos por papel" ON public.agendamentos;

CREATE POLICY "Atualizar agendamentos por papel"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'colaborador'::app_role) AND funcionario_id = current_funcionario_id())
  OR (has_role(auth.uid(), 'cliente'::app_role) AND cliente_id = current_cliente_id())
);