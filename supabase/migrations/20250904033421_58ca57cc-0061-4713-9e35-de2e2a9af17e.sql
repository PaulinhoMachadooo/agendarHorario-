-- Fix RLS policies for funcionarios table to allow admin operations
DROP POLICY IF EXISTS "Administradores podem atualizar funcionários" ON public.funcionarios;
DROP POLICY IF EXISTS "Administradores podem deletar funcionários" ON public.funcionarios;
DROP POLICY IF EXISTS "Funcionários podem ver próprio perfil" ON public.funcionarios;
DROP POLICY IF EXISTS "Permitir inserção de funcionários" ON public.funcionarios;

-- Create new permissive policies for funcionarios
CREATE POLICY "Administradores e funcionários podem ver funcionários" 
ON public.funcionarios 
FOR SELECT 
USING (
  public.get_current_user_role() = 'administrador'::nivel_acesso 
  OR user_id = auth.uid()
);

CREATE POLICY "Administradores podem inserir funcionários" 
ON public.funcionarios 
FOR INSERT 
WITH CHECK (
  NOT EXISTS (SELECT 1 FROM funcionarios WHERE ativo = true)
  OR public.get_current_user_role() = 'administrador'::nivel_acesso
);

CREATE POLICY "Administradores podem atualizar funcionários" 
ON public.funcionarios 
FOR UPDATE 
USING (
  public.get_current_user_role() = 'administrador'::nivel_acesso
  OR user_id = auth.uid()
);

CREATE POLICY "Administradores podem deletar funcionários" 
ON public.funcionarios 
FOR DELETE 
USING (
  public.get_current_user_role() = 'administrador'::nivel_acesso
  AND id != (SELECT id FROM funcionarios WHERE user_id = auth.uid())
);

-- Fix RLS policies for comissoes table
DROP POLICY IF EXISTS "Administradores podem gerenciar comissões" ON public.comissoes;
DROP POLICY IF EXISTS "Funcionários podem ver suas comissões" ON public.comissoes;

CREATE POLICY "Administradores podem gerenciar comissões" 
ON public.comissoes 
FOR ALL 
USING (public.get_current_user_role() = 'administrador'::nivel_acesso);

CREATE POLICY "Funcionários podem ver suas comissões" 
ON public.comissoes 
FOR SELECT 
USING (
  funcionario_id IN (SELECT id FROM funcionarios WHERE user_id = auth.uid())
  OR public.get_current_user_role() = 'administrador'::nivel_acesso
);