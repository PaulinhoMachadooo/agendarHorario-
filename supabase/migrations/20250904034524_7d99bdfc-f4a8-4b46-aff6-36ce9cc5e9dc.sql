-- Atualizar o registro de funcionário existente linkando com o usuário criado
UPDATE public.funcionarios 
SET user_id = 'fad0d530-d380-473f-b0a0-c614d66fde0a' 
WHERE email = 'paulinhomachado.pf@gmail.com' AND user_id IS NULL;

-- Melhorar o trigger para funcionar mesmo com confirmação de email pendente
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Primeiro, tenta atualizar um funcionário existente com o mesmo email
  UPDATE public.funcionarios 
  SET user_id = NEW.id 
  WHERE email = NEW.email AND user_id IS NULL;
  
  -- Se não encontrou funcionário existente E tem metadata no signup, cria novo
  IF NOT FOUND AND NEW.raw_user_meta_data IS NOT NULL AND 
     NEW.raw_user_meta_data->>'nome' IS NOT NULL AND
     NEW.raw_user_meta_data->>'cargo' IS NOT NULL THEN
    
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
      COALESCE(NEW.raw_user_meta_data->>'telefone', ''),
      (NEW.raw_user_meta_data->>'cargo')::cargo_funcionario,
      COALESCE((NEW.raw_user_meta_data->>'nivel_acesso')::nivel_acesso, 'funcionario'::nivel_acesso)
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();