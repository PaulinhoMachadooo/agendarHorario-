-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Administradores podem ver todos os funcionários" ON public.funcionarios;

-- Drop the function that may be causing recursion
DROP FUNCTION IF EXISTS get_user_role() CASCADE;

-- Create a simple, safe function to get user role without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS nivel_acesso
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT nivel_acesso
  FROM funcionarios
  WHERE user_id = auth.uid()
    AND ativo = true
  LIMIT 1;
$$;

-- Create new safe policies
CREATE POLICY "Administradores podem ver todos funcionários"
  ON public.funcionarios
  FOR ALL
  TO authenticated
  USING (
    -- Allow if user is admin (without recursion)
    EXISTS (
      SELECT 1 FROM funcionarios 
      WHERE user_id = auth.uid() 
        AND nivel_acesso = 'administrador' 
        AND ativo = true
    )
    OR
    -- Allow users to see their own record
    user_id = auth.uid()
  );

-- Update other policies to use direct checks instead of the function
DROP POLICY IF EXISTS "Administradores podem atualizar funcionários" ON public.funcionarios;
DROP POLICY IF EXISTS "Administradores podem deletar funcionários" ON public.funcionarios;
DROP POLICY IF EXISTS "Administradores podem ver todos funcionários" ON public.funcionarios;

CREATE POLICY "Administradores podem atualizar funcionários"
  ON public.funcionarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM funcionarios admin
      WHERE admin.user_id = auth.uid() 
        AND admin.nivel_acesso = 'administrador' 
        AND admin.ativo = true
        AND admin.id != funcionarios.id  -- Avoid self-reference
    )
  );

CREATE POLICY "Administradores podem deletar funcionários"
  ON public.funcionarios
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM funcionarios admin
      WHERE admin.user_id = auth.uid() 
        AND admin.nivel_acesso = 'administrador' 
        AND admin.ativo = true
        AND admin.id != funcionarios.id  -- Avoid self-reference
    )
  );

-- Fix the insert policy
DROP POLICY IF EXISTS "Permitir inserção de funcionários" ON public.funcionarios;

CREATE POLICY "Permitir inserção de funcionários"
  ON public.funcionarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if no funcionarios exist (first user) OR user is admin
    NOT EXISTS (SELECT 1 FROM funcionarios WHERE ativo = true)
    OR 
    EXISTS (
      SELECT 1 FROM funcionarios admin
      WHERE admin.user_id = auth.uid() 
        AND admin.nivel_acesso = 'administrador' 
        AND admin.ativo = true
    )
  );