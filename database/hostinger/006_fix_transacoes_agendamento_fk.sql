-- Ensure financial transactions are removed when the related appointment is deleted
-- Run in existing environments after 001-005.

USE `u278136558_AgendaFran`;

-- Clean orphan rows created by previous ON DELETE SET NULL behavior
DELETE FROM transacoes_financeiras WHERE agendamento_id IS NULL;

-- Recreate foreign key with ON DELETE CASCADE
ALTER TABLE transacoes_financeiras
  DROP FOREIGN KEY fk_transacoes_agendamento;

ALTER TABLE transacoes_financeiras
  ADD CONSTRAINT fk_transacoes_agendamento
  FOREIGN KEY (agendamento_id) REFERENCES agendamentos(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
