-- Função que cria automaticamente o registro em public.clientes quando um novo usuário do tipo "cliente" se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo TEXT;
  v_nome TEXT;
  v_telefone TEXT;
BEGIN
  v_tipo := COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', '');
  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', '');
  v_telefone := COALESCE(NEW.raw_user_meta_data->>'telefone', '');

  IF v_tipo = 'cliente' THEN
    INSERT INTO public.clientes (user_id, nome, email, telefone)
    VALUES (NEW.id, v_nome, NEW.email, v_telefone)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Cria o trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_cliente ON auth.users;
CREATE TRIGGER on_auth_user_created_cliente
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_cliente();

-- Garante que o trigger de roles também esteja ativo
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Sincroniza clientes existentes no auth.users que ainda não possuem registro em public.clientes
INSERT INTO public.clientes (user_id, nome, email, telefone)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'nome', 'Cliente'),
  u.email,
  COALESCE(u.raw_user_meta_data->>'telefone', '')
FROM auth.users u
WHERE COALESCE(u.raw_user_meta_data->>'tipo_usuario', '') = 'cliente'
  AND NOT EXISTS (
    SELECT 1 FROM public.clientes c WHERE c.user_id = u.id
  );

-- Também garante que esses usuários tenham o role 'cliente' atribuído
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'cliente'::app_role
FROM auth.users u
WHERE COALESCE(u.raw_user_meta_data->>'tipo_usuario', '') = 'cliente'
ON CONFLICT (user_id, role) DO NOTHING;