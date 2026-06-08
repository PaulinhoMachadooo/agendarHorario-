-- Backfill financial transactions for already concluded appointments
-- Run this once if concluded services are not appearing in transacoes_financeiras.

USE `u278136558_AgendaFran`;

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
  UUID() AS id,
  a.id AS agendamento_id,
  a.funcionario_id,
  COALESCE(s.preco, 0) AS valor_servico,
  CASE
    WHEN c.tipo_comissao = 'porcentagem' THEN COALESCE(s.preco, 0) * COALESCE(c.valor, 0) / 100
    WHEN c.tipo_comissao = 'fixo' THEN COALESCE(c.valor, 0)
    ELSE 0
  END AS valor_comissao,
  a.forma_pagamento,
  NOW() AS created_at,
  NOW() AS updated_at
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
LEFT JOIN transacoes_financeiras tf ON tf.agendamento_id = a.id
WHERE tf.id IS NULL
  AND a.status IN ('concluido', 'concluído');
