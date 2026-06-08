CREATE TABLE IF NOT EXISTS public.servicos_quitados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agendamento_id UUID,
  cliente_id UUID,
  servico_id UUID,
  funcionario_id UUID,
  funcionario TEXT,
  data_hora TIMESTAMP WITH TIME ZONE,
  data_quitacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valor_servico NUMERIC NOT NULL DEFAULT 0,
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos_quitados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver quitados por papel"
  ON public.servicos_quitados FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (public.has_role(auth.uid(), 'colaborador'::public.app_role) AND funcionario_id = public.current_funcionario_id())
  );

CREATE POLICY "Inserir quitados por papel"
  ON public.servicos_quitados FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (public.has_role(auth.uid(), 'colaborador'::public.app_role) AND funcionario_id = public.current_funcionario_id())
  );

CREATE POLICY "Admin atualiza quitados"
  ON public.servicos_quitados FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin exclui quitados"
  ON public.servicos_quitados FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_servicos_quitados_updated_at
  BEFORE UPDATE ON public.servicos_quitados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_sq_funcionario_id ON public.servicos_quitados(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_sq_data_quitacao ON public.servicos_quitados(data_quitacao);