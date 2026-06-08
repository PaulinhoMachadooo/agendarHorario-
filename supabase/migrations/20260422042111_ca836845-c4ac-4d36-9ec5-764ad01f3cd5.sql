-- Trigger: ao criar usuário no auth.users, atribui papel com base em metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nivel TEXT;
  v_tipo TEXT;
  v_role public.app_role;
BEGIN
  v_nivel := COALESCE(NEW.raw_user_meta_data->>'nivel_acesso', '');
  v_tipo  := COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', '');

  IF v_tipo = 'cliente' THEN
    v_role := 'cliente';
  ELSIF v_nivel = 'administrador' THEN
    v_role := 'admin';
  ELSE
    v_role := 'colaborador';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Índice para consultas por user_id
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);