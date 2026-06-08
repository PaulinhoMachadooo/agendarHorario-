-- Criar uma trigger function para criar funcionário automaticamente quando usuário é confirmado
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o usuário tem metadados de funcionário
  IF NEW.raw_user_meta_data IS NOT NULL AND 
     NEW.raw_user_meta_data->>'nome' IS NOT NULL AND
     NEW.raw_user_meta_data->>'cargo' IS NOT NULL AND
     NEW.email_confirmed_at IS NOT NULL THEN
    
    -- Inserir funcionário com dados dos metadados
    INSERT INTO public.funcionarios (
      user_id, 
      nome, 
      email, 
      telefone, 
      cargo, 
      nivel_acesso
    ) VALUES (
      NEW.id,
      NEW.raw_user_meta_data->>'nome',
      NEW.email,
      '',
      (NEW.raw_user_meta_data->>'cargo')::cargo_funcionario,
      COALESCE((NEW.raw_user_meta_data->>'nivel_acesso')::nivel_acesso, 'funcionario'::nivel_acesso)
    )
    ON CONFLICT (user_id) DO NOTHING; -- Evitar duplicatas
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Criar trigger para usuários confirmados
CREATE OR REPLACE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user_signup();