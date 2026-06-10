-- Create table for paid/settled services (quitados)
-- Run this after 001-007 in existing Hostinger databases.

USE `u278136558_AgendaFran`;

ALTER TABLE agendamentos
  MODIFY COLUMN status ENUM('agendado', 'pendente', 'confirmado', 'cancelado', 'concluido', 'quitado') NOT NULL DEFAULT 'agendado';

CREATE TABLE IF NOT EXISTS quitados (
  id CHAR(36) NOT NULL PRIMARY KEY,
  agendamento_id CHAR(36) NULL,
  cliente_id CHAR(36) NOT NULL,
  servico_id CHAR(36) NOT NULL,
  funcionario_id CHAR(36) NULL,
  funcionario VARCHAR(120) NOT NULL DEFAULT '',
  data_hora DATETIME NOT NULL,
  valor_servico DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_comissao DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  forma_pagamento ENUM('dinheiro','cartao_debito','cartao_credito','pix','pacote','em_aberto') NOT NULL,
  observacoes TEXT NULL,
  data_quitacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_quitados_agendamento_id (agendamento_id),
  INDEX idx_quitados_cliente_id (cliente_id),
  INDEX idx_quitados_servico_id (servico_id),
  INDEX idx_quitados_funcionario_id (funcionario_id),
  INDEX idx_quitados_data_quitacao (data_quitacao),
  INDEX idx_quitados_forma_pagamento (forma_pagamento)
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS trg_agendamento_concluido_financeiro;

DELIMITER $$

CREATE TRIGGER trg_agendamento_concluido_financeiro
AFTER UPDATE ON agendamentos
FOR EACH ROW
BEGIN
  DECLARE v_valor_servico DECIMAL(10,2) DEFAULT 0.00;
  DECLARE v_tipo_comissao VARCHAR(20) DEFAULT 'porcentagem';
  DECLARE v_valor_comissao_cfg DECIMAL(10,2) DEFAULT 0.00;
  DECLARE v_valor_comissao_final DECIMAL(10,2) DEFAULT 0.00;

  IF NEW.status IN ('concluido', 'quitado') AND OLD.status <> NEW.status THEN
    SELECT preco
      INTO v_valor_servico
      FROM servicos
     WHERE id = NEW.servico_id
     LIMIT 1;

    IF NEW.funcionario_id IS NOT NULL THEN
      SELECT tipo_comissao, valor
        INTO v_tipo_comissao, v_valor_comissao_cfg
        FROM comissoes
       WHERE funcionario_id = NEW.funcionario_id
       ORDER BY created_at DESC
       LIMIT 1;
    END IF;

    IF v_tipo_comissao = 'porcentagem' THEN
      SET v_valor_comissao_final = (v_valor_servico * v_valor_comissao_cfg) / 100;
    ELSE
      SET v_valor_comissao_final = v_valor_comissao_cfg;
    END IF;

    INSERT INTO transacoes_financeiras (
      id,
      agendamento_id,
      funcionario_id,
      valor_servico,
      valor_comissao,
      forma_pagamento,
      created_at,
      updated_at
    )
    SELECT
      UUID(),
      NEW.id,
      NEW.funcionario_id,
      v_valor_servico,
      v_valor_comissao_final,
      NEW.forma_pagamento,
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM transacoes_financeiras tf WHERE tf.agendamento_id = NEW.id
    );

    IF NEW.status = 'quitado' AND NEW.forma_pagamento IS NOT NULL AND NEW.forma_pagamento <> 'em_aberto' THEN
      INSERT INTO quitados (
        id,
        agendamento_id,
        cliente_id,
        servico_id,
        funcionario_id,
        funcionario,
        data_hora,
        valor_servico,
        valor_comissao,
        forma_pagamento,
        observacoes,
        data_quitacao,
        created_at,
        updated_at
      )
      SELECT
        UUID(),
        NEW.id,
        NEW.cliente_id,
        NEW.servico_id,
        NEW.funcionario_id,
        NEW.funcionario,
        NEW.data_hora,
        v_valor_servico,
        v_valor_comissao_final,
        NEW.forma_pagamento,
        NEW.observacoes,
        NOW(),
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM quitados q WHERE q.agendamento_id = NEW.id
      );
    END IF;
  END IF;
END $$

DELIMITER ;

-- Optional migration from the old table name, only if it exists.
SET @has_old_servicos_quitados := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'servicos_quitados'
);

SET @copy_old_servicos_quitados := IF(@has_old_servicos_quitados = 1,
  'INSERT IGNORE INTO quitados (id, agendamento_id, cliente_id, servico_id, funcionario_id, funcionario, data_hora, valor_servico, forma_pagamento, observacoes, data_quitacao, created_at, updated_at) SELECT id, agendamento_id, cliente_id, servico_id, funcionario_id, funcionario, data_hora, valor_servico, forma_pagamento, observacoes, data_quitacao, COALESCE(data_quitacao, NOW()), COALESCE(data_quitacao, NOW()) FROM servicos_quitados',
  'SELECT 1'
);
PREPARE stmt_copy_old_servicos_quitados FROM @copy_old_servicos_quitados;
EXECUTE stmt_copy_old_servicos_quitados;
DEALLOCATE PREPARE stmt_copy_old_servicos_quitados;

-- Backfill appointments already marked as quitado.
INSERT IGNORE INTO quitados (
  id,
  agendamento_id,
  cliente_id,
  servico_id,
  funcionario_id,
  funcionario,
  data_hora,
  valor_servico,
  valor_comissao,
  forma_pagamento,
  observacoes,
  data_quitacao,
  created_at,
  updated_at
)
SELECT
  UUID(),
  a.id,
  a.cliente_id,
  a.servico_id,
  a.funcionario_id,
  a.funcionario,
  a.data_hora,
  COALESCE(s.preco, 0),
  CASE
    WHEN c.tipo_comissao = 'porcentagem' THEN COALESCE(s.preco, 0) * COALESCE(c.valor, 0) / 100
    WHEN c.tipo_comissao = 'fixo' THEN COALESCE(c.valor, 0)
    ELSE 0
  END,
  a.forma_pagamento,
  a.observacoes,
  NOW(),
  NOW(),
  NOW()
FROM agendamentos a
LEFT JOIN servicos s ON s.id = a.servico_id
LEFT JOIN (
  SELECT c1.funcionario_id, c1.tipo_comissao, c1.valor
  FROM comissoes c1
  INNER JOIN (
    SELECT funcionario_id, MAX(created_at) AS max_created_at
    FROM comissoes
    GROUP BY funcionario_id
  ) c2 ON c1.funcionario_id = c2.funcionario_id AND c1.created_at = c2.max_created_at
) c ON c.funcionario_id = a.funcionario_id
WHERE a.status = 'quitado'
  AND a.forma_pagamento IS NOT NULL
  AND a.forma_pagamento <> 'em_aberto';
