-- Add payment method support for concluded appointments and financial reports
-- Run this after 001-004 in existing environments.

USE `u278136558_AgendaFran`;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS forma_pagamento ENUM('dinheiro','cartao_debito','cartao_credito','pix','pacote','em_aberto') NULL AFTER status;

ALTER TABLE transacoes_financeiras
  ADD COLUMN IF NOT EXISTS forma_pagamento ENUM('dinheiro','cartao_debito','cartao_credito','pix','pacote','em_aberto') NULL AFTER valor_comissao;

UPDATE transacoes_financeiras tf
JOIN agendamentos a ON a.id = tf.agendamento_id
SET tf.forma_pagamento = a.forma_pagamento
WHERE tf.forma_pagamento IS NULL;
