-- Add "em_aberto" as a valid payment method for existing environments
-- Run this after 005 in databases that already have forma_pagamento columns.

USE `u278136558_AgendaFran`;

ALTER TABLE agendamentos
  MODIFY COLUMN forma_pagamento ENUM('dinheiro','cartao_debito','cartao_credito','pix','pacote','em_aberto') NULL;

ALTER TABLE transacoes_financeiras
  MODIFY COLUMN forma_pagamento ENUM('dinheiro','cartao_debito','cartao_credito','pix','pacote','em_aberto') NULL;
