-- Permitir que todos (incluindo usuários não autenticados) possam visualizar as configurações da barbearia
CREATE POLICY "Todos podem ver configurações da barbearia"
ON public.configuracoes_barbearia
FOR SELECT
USING (true);

-- Garantir que apenas administradores possam modificar
DROP POLICY IF EXISTS "Apenas administradores podem gerenciar configurações" ON public.configuracoes_barbearia;

CREATE POLICY "Apenas administradores podem inserir configurações"
ON public.configuracoes_barbearia
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM funcionarios f
  WHERE f.user_id = auth.uid() 
    AND f.nivel_acesso = 'administrador'::nivel_acesso 
    AND f.ativo = true
));

CREATE POLICY "Apenas administradores podem atualizar configurações"
ON public.configuracoes_barbearia
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM funcionarios f
  WHERE f.user_id = auth.uid() 
    AND f.nivel_acesso = 'administrador'::nivel_acesso 
    AND f.ativo = true
));

CREATE POLICY "Apenas administradores podem deletar configurações"
ON public.configuracoes_barbearia
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM funcionarios f
  WHERE f.user_id = auth.uid() 
    AND f.nivel_acesso = 'administrador'::nivel_acesso 
    AND f.ativo = true
));