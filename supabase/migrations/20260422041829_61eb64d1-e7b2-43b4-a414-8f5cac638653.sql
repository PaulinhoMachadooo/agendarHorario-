-- 1. Enum de papéis
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'colaborador', 'cliente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função has_role (SECURITY DEFINER, evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 4. Função current_funcionario_id
CREATE OR REPLACE FUNCTION public.current_funcionario_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.funcionarios WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 5. Função current_cliente_id
CREATE OR REPLACE FUNCTION public.current_cliente_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clientes WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 6. Policies em user_roles
CREATE POLICY "Usuario ve seus papeis" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia papeis ins" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia papeis upd" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin gerencia papeis del" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. SERVICOS — drop & recriar
DROP POLICY IF EXISTS "Autenticados podem ver servicos" ON public.servicos;
DROP POLICY IF EXISTS "Autenticados podem inserir servicos" ON public.servicos;
DROP POLICY IF EXISTS "Autenticados podem atualizar servicos" ON public.servicos;
DROP POLICY IF EXISTS "Autenticados podem excluir servicos" ON public.servicos;
CREATE POLICY "Servicos sao publicos" ON public.servicos FOR SELECT USING (true);
CREATE POLICY "Admin insere servicos" ON public.servicos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza servicos" ON public.servicos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin exclui servicos" ON public.servicos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. CLIENTES
DROP POLICY IF EXISTS "Autenticados podem ver clientes" ON public.clientes;
DROP POLICY IF EXISTS "Autenticados podem inserir clientes" ON public.clientes;
DROP POLICY IF EXISTS "Autenticados podem atualizar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Autenticados podem excluir clientes" ON public.clientes;
CREATE POLICY "Equipe ve clientes ou cliente proprio" ON public.clientes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'colaborador')
  OR user_id = auth.uid()
);
CREATE POLICY "Equipe insere clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'colaborador')
  OR user_id = auth.uid()
);
CREATE POLICY "Equipe ou proprio atualiza cliente" ON public.clientes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'colaborador')
  OR user_id = auth.uid()
);
CREATE POLICY "Admin exclui clientes" ON public.clientes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9. FUNCIONARIOS
DROP POLICY IF EXISTS "Autenticados podem ver funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Autenticados podem inserir funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Autenticados podem atualizar funcionarios" ON public.funcionarios;
DROP POLICY IF EXISTS "Autenticados podem excluir funcionarios" ON public.funcionarios;
CREATE POLICY "Equipe ve funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'colaborador')
);
CREATE POLICY "Admin insere funcionarios" ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza funcionarios" ON public.funcionarios FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin exclui funcionarios" ON public.funcionarios FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 10. AGENDAMENTOS
DROP POLICY IF EXISTS "Autenticados podem ver agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Autenticados podem inserir agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Autenticados podem atualizar agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Autenticados podem excluir agendamentos" ON public.agendamentos;
CREATE POLICY "Ver agendamentos por papel" ON public.agendamentos FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'colaborador') AND funcionario_id = public.current_funcionario_id())
  OR (public.has_role(auth.uid(), 'cliente') AND cliente_id = public.current_cliente_id())
);
CREATE POLICY "Inserir agendamentos por papel" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'colaborador')
  OR (public.has_role(auth.uid(), 'cliente') AND cliente_id = public.current_cliente_id())
);
CREATE POLICY "Atualizar agendamentos por papel" ON public.agendamentos FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'colaborador') AND funcionario_id = public.current_funcionario_id())
);
CREATE POLICY "Admin exclui agendamentos" ON public.agendamentos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 11. CONFIGURACOES_BARBEARIA
DROP POLICY IF EXISTS "Qualquer um pode ver configuracoes" ON public.configuracoes_barbearia;
DROP POLICY IF EXISTS "Autenticados podem inserir configuracoes" ON public.configuracoes_barbearia;
DROP POLICY IF EXISTS "Autenticados podem atualizar configuracoes" ON public.configuracoes_barbearia;
CREATE POLICY "Configuracoes sao publicas" ON public.configuracoes_barbearia FOR SELECT USING (true);
CREATE POLICY "Admin insere configuracoes" ON public.configuracoes_barbearia FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza configuracoes" ON public.configuracoes_barbearia FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 12. COMISSOES
DROP POLICY IF EXISTS "Autenticados podem ver comissoes" ON public.comissoes;
DROP POLICY IF EXISTS "Autenticados podem inserir comissoes" ON public.comissoes;
DROP POLICY IF EXISTS "Autenticados podem atualizar comissoes" ON public.comissoes;
DROP POLICY IF EXISTS "Autenticados podem excluir comissoes" ON public.comissoes;
CREATE POLICY "Ver comissoes por papel" ON public.comissoes FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'colaborador') AND funcionario_id = public.current_funcionario_id())
);
CREATE POLICY "Admin insere comissoes" ON public.comissoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza comissoes" ON public.comissoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin exclui comissoes" ON public.comissoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 13. TRANSACOES_FINANCEIRAS
DROP POLICY IF EXISTS "Autenticados podem ver transacoes" ON public.transacoes_financeiras;
DROP POLICY IF EXISTS "Autenticados podem inserir transacoes" ON public.transacoes_financeiras;
DROP POLICY IF EXISTS "Autenticados podem atualizar transacoes" ON public.transacoes_financeiras;
DROP POLICY IF EXISTS "Autenticados podem excluir transacoes" ON public.transacoes_financeiras;
CREATE POLICY "Ver transacoes por papel" ON public.transacoes_financeiras FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.has_role(auth.uid(), 'colaborador') AND funcionario_id = public.current_funcionario_id())
);
CREATE POLICY "Admin insere transacoes" ON public.transacoes_financeiras FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza transacoes" ON public.transacoes_financeiras FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin exclui transacoes" ON public.transacoes_financeiras FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));