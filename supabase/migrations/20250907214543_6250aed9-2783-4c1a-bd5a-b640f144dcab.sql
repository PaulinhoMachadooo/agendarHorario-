-- Corrigir função calcular_comissao para lidar com valores NULL
CREATE OR REPLACE FUNCTION public.calcular_comissao()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  servico_preco NUMERIC;
  comissao_config RECORD;
  valor_comissao NUMERIC := 0; -- Valor padrão
  valor_barbearia NUMERIC;
BEGIN
  -- Só calcular quando status mudar para 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Buscar preço do serviço
    SELECT preco INTO servico_preco 
    FROM public.servicos 
    WHERE id = NEW.servico_id;
    
    -- Se não encontrar o preço, usar 0
    IF servico_preco IS NULL THEN
      servico_preco := 0;
    END IF;
    
    -- Buscar configuração de comissão do funcionário (se existir)
    SELECT tipo_comissao, valor INTO comissao_config
    FROM public.comissoes c
    WHERE c.funcionario_id = NEW.funcionario_id
    ORDER BY c.created_at DESC
    LIMIT 1;
    
    -- Calcular comissão (valor padrão é 0 se não houver configuração)
    IF comissao_config.tipo_comissao IS NOT NULL THEN
      IF comissao_config.tipo_comissao = 'percentual' THEN
        valor_comissao := servico_preco * (COALESCE(comissao_config.valor, 0) / 100);
      ELSE
        valor_comissao := COALESCE(comissao_config.valor, 0);
      END IF;
    END IF;
    
    valor_barbearia := servico_preco - valor_comissao;
    
    -- Inserir transação financeira com valores seguros
    INSERT INTO public.transacoes_financeiras (
      agendamento_id, funcionario_id, valor_servico, valor_comissao, valor_barbearia
    ) VALUES (
      NEW.id, 
      NEW.funcionario_id, 
      COALESCE(servico_preco, 0), 
      COALESCE(valor_comissao, 0), 
      COALESCE(valor_barbearia, 0)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;