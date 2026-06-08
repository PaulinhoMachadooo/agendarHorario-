-- Adicionar user_id à tabela clientes para autenticação
ALTER TABLE public.clientes
ADD COLUMN user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Atualizar RLS policies para clientes
DROP POLICY IF EXISTS "Permitir acesso a clientes" ON public.clientes;

-- Clientes podem ver apenas seus próprios dados
CREATE POLICY "Clientes podem ver próprio perfil"
ON public.clientes
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM funcionarios 
  WHERE funcionarios.user_id = auth.uid() AND funcionarios.ativo = true
));

-- Clientes podem criar seu perfil
CREATE POLICY "Clientes podem criar perfil"
ON public.clientes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Clientes podem atualizar apenas seus dados
CREATE POLICY "Clientes podem atualizar próprio perfil"
ON public.clientes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM funcionarios 
  WHERE funcionarios.user_id = auth.uid() AND funcionarios.ativo = true
));

-- Funcionários podem deletar clientes
CREATE POLICY "Funcionários podem deletar clientes"
ON public.clientes
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM funcionarios 
  WHERE funcionarios.user_id = auth.uid() AND funcionarios.ativo = true
));

-- Atualizar RLS policies para agendamentos
DROP POLICY IF EXISTS "Permitir acesso a agendamentos" ON public.agendamentos;

-- Funcionários veem todos os agendamentos
CREATE POLICY "Funcionários veem todos agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM funcionarios 
  WHERE funcionarios.user_id = auth.uid() AND funcionarios.ativo = true
));

-- Clientes veem apenas seus agendamentos
CREATE POLICY "Clientes veem próprios agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (cliente_id IN (
  SELECT id FROM clientes WHERE user_id = auth.uid()
));

-- Clientes podem criar seus agendamentos
CREATE POLICY "Clientes podem criar agendamentos"
ON public.agendamentos
FOR INSERT
TO authenticated
WITH CHECK (cliente_id IN (
  SELECT id FROM clientes WHERE user_id = auth.uid()
));

-- Funcionários podem criar qualquer agendamento
CREATE POLICY "Funcionários podem criar agendamentos"
ON public.agendamentos
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM funcionarios 
  WHERE funcionarios.user_id = auth.uid() AND funcionarios.ativo = true
));

-- Funcionários podem atualizar agendamentos
CREATE POLICY "Funcionários podem atualizar agendamentos"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM funcionarios 
  WHERE funcionarios.user_id = auth.uid() AND funcionarios.ativo = true
));

-- Clientes podem cancelar (atualizar status) seus agendamentos
CREATE POLICY "Clientes podem cancelar próprios agendamentos"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (cliente_id IN (
  SELECT id FROM clientes WHERE user_id = auth.uid()
))
WITH CHECK (cliente_id IN (
  SELECT id FROM clientes WHERE user_id = auth.uid()
));

-- Funcionários podem deletar agendamentos
CREATE POLICY "Funcionários podem deletar agendamentos"
ON public.agendamentos
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM funcionarios 
  WHERE funcionarios.user_id = auth.uid() AND funcionarios.ativo = true
));

-- Criar função para novo cadastro de cliente
CREATE OR REPLACE FUNCTION public.handle_new_client_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Se o usuário tem metadata indicando que é cliente, criar registro
  IF NEW.raw_user_meta_data IS NOT NULL AND 
     NEW.raw_user_meta_data->>'user_type' = 'cliente' AND
     NEW.raw_user_meta_data->>'nome' IS NOT NULL THEN
    
    INSERT INTO public.clientes (
      user_id, 
      nome, 
      email, 
      telefone
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'nome',
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'telefone', '')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Criar trigger para cadastro de cliente
DROP TRIGGER IF EXISTS on_client_user_created ON auth.users;
CREATE TRIGGER on_client_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_client_signup();