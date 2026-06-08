-- Remover políticas problemáticas e recriar de forma correta
DROP POLICY IF EXISTS "Administradores podem gerenciar funcionários" ON public.funcionarios;
DROP POLICY IF EXISTS "Permitir inserção inicial de funcionários" ON public.funcionarios;

-- Permitir que administradores vejam e gerenciem todos os funcionários
CREATE POLICY "Administradores podem ver funcionários"
ON public.funcionarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios admin 
    WHERE admin.user_id = auth.uid() 
    AND admin.nivel_acesso = 'administrador' 
    AND admin.ativo = true
    AND admin.id != funcionarios.id -- Evitar auto-referência
  )
  OR user_id = auth.uid() -- Funcionário pode ver próprio perfil
);

-- Permitir que administradores atualizem funcionários
CREATE POLICY "Administradores podem atualizar funcionários"
ON public.funcionarios
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios admin 
    WHERE admin.user_id = auth.uid() 
    AND admin.nivel_acesso = 'administrador' 
    AND admin.ativo = true
    AND admin.id != funcionarios.id
  )
);

-- Permitir que administradores deletem funcionários
CREATE POLICY "Administradores podem deletar funcionários"
ON public.funcionarios
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.funcionarios admin 
    WHERE admin.user_id = auth.uid() 
    AND admin.nivel_acesso = 'administrador' 
    AND admin.ativo = true
    AND admin.id != funcionarios.id
  )
);

-- Política especial para inserção - permitir primeiro usuário ou administradores
CREATE POLICY "Permitir cadastro de funcionários"
ON public.funcionarios
FOR INSERT
TO authenticated
WITH CHECK (
  -- Permitir se não há funcionários ativos (primeiro usuário)
  (SELECT COUNT(*) FROM public.funcionarios WHERE ativo = true) = 0
  OR
  -- Ou se é um administrador cadastrando
  EXISTS (
    SELECT 1 FROM public.funcionarios admin 
    WHERE admin.user_id = auth.uid() 
    AND admin.nivel_acesso = 'administrador' 
    AND admin.ativo = true
  )
);