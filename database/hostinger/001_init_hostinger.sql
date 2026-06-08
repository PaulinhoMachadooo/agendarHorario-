-- Hostinger SQL (MySQL 8+) bootstrap migration
-- Execute in Hostinger phpMyAdmin or MySQL CLI.

-- IMPORTANT (Hostinger shared):
-- 1) Edit the USE line below with your real DB name before running the script.
-- 2) Do not use CREATE DATABASE on shared hosting; it may cause #1044.
-- 3) If using phpMyAdmin, you can also click the DB in the left sidebar before executing.

-- REQUIRED: set your database name here to avoid #1046.
-- Example: USE `u123456789_barber`;
USE `u278136558_AgendaFran`;

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- Base tables

CREATE TABLE IF NOT EXISTS auth_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  user_metadata LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token VARCHAR(128) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_auth_sessions_user
    FOREIGN KEY (user_id) REFERENCES auth_users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_auth_sessions_user_id (user_id),
  INDEX idx_auth_sessions_expires_at (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  telefone VARCHAR(25) NOT NULL DEFAULT '',
  email VARCHAR(180) NOT NULL DEFAULT '',
  data_cadastro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultima_visita TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_clientes_user_id (user_id),
  INDEX idx_clientes_nome (nome),
  INDEX idx_clientes_telefone (telefone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS servicos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  preco DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tempo_medio INT NOT NULL DEFAULT 30,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_servicos_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS funcionarios (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL DEFAULT '',
  telefone VARCHAR(25) NOT NULL DEFAULT '',
  cargo VARCHAR(50) NOT NULL DEFAULT 'barbeiro',
  nivel_acesso VARCHAR(30) NOT NULL DEFAULT 'funcionario',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_funcionarios_user_id (user_id),
  INDEX idx_funcionarios_ativo (ativo),
  INDEX idx_funcionarios_cargo (cargo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comissoes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  funcionario_id CHAR(36) NOT NULL,
  tipo_comissao ENUM('porcentagem', 'fixo') NOT NULL DEFAULT 'porcentagem',
  valor DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comissoes_funcionario
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_comissoes_funcionario_id (funcionario_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracoes_barbearia (
  id CHAR(36) NOT NULL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL DEFAULT 'Barbearia Premium',
  endereco VARCHAR(255) NOT NULL DEFAULT 'Rua Principal, 123',
  telefone VARCHAR(25) NOT NULL DEFAULT '(11) 99999-9999',
  logo_url VARCHAR(600) NOT NULL DEFAULT '',
  banner_url VARCHAR(600) NOT NULL DEFAULT '',
  horario_abertura TIME NOT NULL DEFAULT '08:00:00',
  horario_fechamento TIME NOT NULL DEFAULT '18:00:00',
  horario_almoco_inicio TIME NULL,
  horario_almoco_fim TIME NULL,
  dias_funcionamento LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS agendamentos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  cliente_id CHAR(36) NOT NULL,
  servico_id CHAR(36) NOT NULL,
  funcionario_id CHAR(36) NULL,
  funcionario VARCHAR(120) NOT NULL DEFAULT '',
  data_hora DATETIME NOT NULL,
  status ENUM('agendado', 'pendente', 'confirmado', 'cancelado', 'concluido') NOT NULL DEFAULT 'agendado',
  forma_pagamento ENUM('dinheiro','cartao_debito','cartao_credito','pix','pacote','em_aberto') NULL,
  observacoes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_agendamentos_cliente
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_agendamentos_servico
    FOREIGN KEY (servico_id) REFERENCES servicos(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_agendamentos_funcionario
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_agendamentos_data_hora (data_hora),
  INDEX idx_agendamentos_cliente_id (cliente_id),
  INDEX idx_agendamentos_funcionario_id (funcionario_id),
  INDEX idx_agendamentos_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transacoes_financeiras (
  id CHAR(36) NOT NULL PRIMARY KEY,
  agendamento_id CHAR(36) NULL,
  funcionario_id CHAR(36) NULL,
  valor_servico DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_comissao DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  forma_pagamento ENUM('dinheiro','cartao_debito','cartao_credito','pix','pacote','em_aberto') NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_transacoes_agendamento
    FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_transacoes_funcionario
    FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_transacoes_agendamento_id (agendamento_id),
  INDEX idx_transacoes_funcionario_id (funcionario_id),
  INDEX idx_transacoes_created_at (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Seed defaults
-- ---------------------------------------------------------------------------

INSERT INTO configuracoes_barbearia (
  id,
  nome,
  endereco,
  telefone,
  dias_funcionamento
)
SELECT
  UUID(),
  'Barbearia Premium',
  'Rua Principal, 123',
  '(11) 99999-9999',
  '["segunda","terca","quarta","quinta","sexta","sabado"]'
WHERE NOT EXISTS (SELECT 1 FROM configuracoes_barbearia);

-- ---------------------------------------------------------------------------
-- Trigger to generate financeiro entries when an appointment is completed
-- ---------------------------------------------------------------------------

DELIMITER $$

DROP TRIGGER IF EXISTS trg_agendamento_concluido_financeiro $$
CREATE TRIGGER trg_agendamento_concluido_financeiro
AFTER UPDATE ON agendamentos
FOR EACH ROW
BEGIN
  DECLARE v_valor_servico DECIMAL(10,2) DEFAULT 0.00;
  DECLARE v_tipo_comissao VARCHAR(20) DEFAULT 'porcentagem';
  DECLARE v_valor_comissao_cfg DECIMAL(10,2) DEFAULT 0.00;
  DECLARE v_valor_comissao_final DECIMAL(10,2) DEFAULT 0.00;

  IF NEW.status = 'concluido' AND OLD.status <> 'concluido' THEN
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
    ) VALUES (
      UUID(),
      NEW.id,
      NEW.funcionario_id,
      v_valor_servico,
      v_valor_comissao_final,
      NEW.forma_pagamento,
      NOW(),
      NOW()
    );
  END IF;
END $$

DELIMITER ;
