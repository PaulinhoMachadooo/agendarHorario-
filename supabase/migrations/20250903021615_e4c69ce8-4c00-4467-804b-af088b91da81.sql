-- Update the existing funcionario record to link it with the authenticated user
UPDATE funcionarios 
SET user_id = '254e1576-b5da-4cf1-925c-c415f8db6b1b' 
WHERE email = 'paulinhomachado15@gmail.com' AND user_id IS NULL;

-- Update the trigger to properly handle signup and link existing records
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Try to update existing funcionario record first (link by email)
  UPDATE public.funcionarios 
  SET user_id = NEW.id 
  WHERE email = NEW.email AND user_id IS NULL;
  
  -- If no existing record was updated and user has metadata, create new record
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
$function$