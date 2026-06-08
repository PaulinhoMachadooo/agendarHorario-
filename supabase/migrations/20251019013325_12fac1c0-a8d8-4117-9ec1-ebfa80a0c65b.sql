-- Permitir busca de email por telefone para login
CREATE POLICY "Permitir busca por telefone para login"
ON public.clientes
FOR SELECT
TO anon
USING (true);