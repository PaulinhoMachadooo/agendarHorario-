-- Primeiro vamos corrigir a constraint no user_id para ser UNIQUE
ALTER TABLE public.funcionarios 
ADD CONSTRAINT funcionarios_user_id_unique UNIQUE (user_id);

-- Agora vamos corrigir o trigger para funcionar corretamente
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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