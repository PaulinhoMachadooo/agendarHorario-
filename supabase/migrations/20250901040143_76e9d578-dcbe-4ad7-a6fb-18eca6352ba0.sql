-- Criar função security definer para evitar recursão infinita
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT nivel_acesso::text 
  FROM public.funcionarios 
  WHERE user_id = auth.uid() AND ativo = true
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = 'public';

-- Remover todas as políticas atuais de funcionários
DROP POLICY IF EXISTS "Administradores podem ver funcionários" ON public.funcionarios;
DROP POLICY IF EXISTS "Funcionários podem ver seus próprios dados" ON public.funcionarios;
DROP POLICY IF EXISTS "Administradores podem atualizar funcionários" ON public.funcionarios;
DROP POLICY IF EXISTS "Administradores podem deletar funcionários" ON public.funcionarios;
DROP POLICY IF EXISTS "Permitir cadastro de funcionários" ON public.funcionarios;

-- Criar políticas simples usando a função
CREATE POLICY "Funcionários podem ver próprio perfil"
ON public.funcionarios
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Administradores podem ver todos funcionários"
ON public.funcionarios
FOR SELECT
TO authenticated
USING (public.get_user_role() = 'administrador');

CREATE POLICY "Administradores podem atualizar funcionários"
ON public.funcionarios
FOR UPDATE
TO authenticated
USING (public.get_user_role() = 'administrador');

CREATE POLICY "Administradores podem deletar funcionários"
ON public.funcionarios
FOR DELETE
TO authenticated
USING (public.get_user_role() = 'administrador');

-- Política para inserção - permitir primeiro usuário sempre, depois só admins
CREATE POLICY "Permitir inserção de funcionários"
ON public.funcionarios
FOR INSERT
TO authenticated
WITH CHECK (
  -- Se não há funcionários, permitir (primeiro usuário)
  NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE ativo = true)
  OR
  -- Se há funcionários, só permitir se for admin
  public.get_user_role() = 'administrador'
);