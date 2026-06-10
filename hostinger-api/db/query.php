<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$input = json_body();
$table = (string)($input['table'] ?? '');
$action = (string)($input['action'] ?? 'select');
$selectColumns = (string)($input['columns'] ?? '*');
$filters = $input['filters'] ?? [];
$orderBy = $input['orderBy'] ?? null;
$rows = $input['rows'] ?? [];
$values = $input['values'] ?? [];
$single = (bool)($input['single'] ?? false);
$maybeSingle = (bool)($input['maybeSingle'] ?? false);

$allowedTables = [
    'clientes' => ['id','user_id','nome','telefone','email','data_cadastro','ultima_visita','created_at','updated_at'],
    'servicos' => ['id','nome','preco','tempo_medio','created_at','updated_at'],
    'funcionarios' => ['id','user_id','nome','email','telefone','cargo','nivel_acesso','ativo','created_at','updated_at'],
    'comissoes' => ['id','funcionario_id','tipo_comissao','valor','created_at','updated_at'],
    'configuracoes_barbearia' => ['id','nome','endereco','telefone','logo_url','banner_url','horario_abertura','horario_fechamento','horario_almoco_inicio','horario_almoco_fim','dias_funcionamento','created_at','updated_at'],
    'agendamentos' => ['id','cliente_id','servico_id','funcionario_id','funcionario','data_hora','status','forma_pagamento','observacoes','created_at','updated_at'],
    'transacoes_financeiras' => ['id','agendamento_id','funcionario_id','valor_servico','valor_comissao','forma_pagamento','created_at','updated_at'],
    'quitados' => ['id','agendamento_id','cliente_id','servico_id','funcionario_id','funcionario','data_hora','valor_servico','valor_comissao','forma_pagamento','observacoes','data_quitacao','created_at','updated_at'],
];

function get_table_columns(string $table): array {
    static $cache = [];
    if (isset($cache[$table])) {
        return $cache[$table];
    }

    try {
        $stmt = db()->query("SHOW COLUMNS FROM {$table}");
        $cols = [];
        foreach ($stmt->fetchAll() as $row) {
            if (isset($row['Field'])) {
                $cols[] = (string)$row['Field'];
            }
        }
        $cache[$table] = $cols;
        return $cols;
    } catch (Throwable $e) {
        $cache[$table] = [];
        return [];
    }
}

function has_column(string $table, string $column): bool {
    return in_array($column, get_table_columns($table), true);
}

foreach ($allowedTables as $tableName => $tableAllowedColumns) {
    $existingColumns = get_table_columns($tableName);
    if ($existingColumns) {
        $allowedTables[$tableName] = array_values(array_intersect($tableAllowedColumns, $existingColumns));
    }
}

if (!isset($allowedTables[$table])) {
    respond(['data' => null, 'error' => ['message' => 'Tabela inválida']], 422);
}

$user = current_user();

$isAnonymousAllowed = false;
if (!$user) {
    $isRead = $action === 'select';
    $isInsert = $action === 'insert';

    $publicReadTables = ['servicos', 'configuracoes_barbearia'];
    $publicReadWithFilters = ['funcionarios', 'agendamentos', 'clientes'];
    $publicInsertTables = ['clientes', 'agendamentos'];

    if ($isRead && in_array($table, $publicReadTables, true)) {
        $isAnonymousAllowed = true;
    }

    if ($isRead && in_array($table, $publicReadWithFilters, true)) {
        $isAnonymousAllowed = true;
    }

    if ($isInsert && in_array($table, $publicInsertTables, true)) {
        $isAnonymousAllowed = true;
    }

    if (!$isAnonymousAllowed) {
        respond(['data' => null, 'error' => ['message' => 'Não autenticado']], 401);
    }
}

function map_operator(string $op): string {
    return match ($op) {
        'eq' => '=',
        'neq' => '!=',
        'gte' => '>=',
        'lte' => '<=',
        'lt' => '<',
        default => '=',
    };
}



function is_concluded_status(?string $status): bool {
    if ($status === null) return false;
    $value = mb_strtolower(trim($status));
    return in_array($value, ['concluido', 'concluído'], true);
}

function is_paid_status(?string $status): bool {
    if ($status === null) return false;
    $value = mb_strtolower(trim($status));
    return in_array($value, ['quitado', 'quitada'], true);
}

function is_finished_status(?string $status): bool {
    return is_concluded_status($status) || is_paid_status($status);
}

function calculate_service_values(string $servicoId, ?string $funcionarioId): array {
    $servicoStmt = db()->prepare('SELECT preco FROM servicos WHERE id = :id LIMIT 1');
    $servicoStmt->execute([':id' => $servicoId]);
    $servico = $servicoStmt->fetch();
    $valorServico = (float)($servico['preco'] ?? 0);

    $valorComissao = 0.0;
    if ($funcionarioId) {
        $comissaoStmt = db()->prepare('SELECT tipo_comissao, valor FROM comissoes WHERE funcionario_id = :funcionario_id ORDER BY created_at DESC LIMIT 1');
        $comissaoStmt->execute([':funcionario_id' => $funcionarioId]);
        $comissao = $comissaoStmt->fetch();

        if ($comissao) {
            if (($comissao['tipo_comissao'] ?? 'porcentagem') === 'porcentagem') {
                $valorComissao = ($valorServico * (float)$comissao['valor']) / 100;
            } else {
                $valorComissao = (float)$comissao['valor'];
            }
        }
    }

    return [$valorServico, $valorComissao];
}

function ensure_financial_transaction(string $agendamentoId, string $servicoId, ?string $funcionarioId, ?string $formaPagamento): void {
    $existsStmt = db()->prepare('SELECT id FROM transacoes_financeiras WHERE agendamento_id = :agendamento_id LIMIT 1');
    $existsStmt->execute([':agendamento_id' => $agendamentoId]);
    if ($existsStmt->fetch()) {
        return;
    }

    [$valorServico, $valorComissao] = calculate_service_values($servicoId, $funcionarioId);

    if (has_column('transacoes_financeiras', 'forma_pagamento')) {
        $insertStmt = db()->prepare('INSERT INTO transacoes_financeiras (id, agendamento_id, funcionario_id, valor_servico, valor_comissao, forma_pagamento, created_at, updated_at) VALUES (:id, :agendamento_id, :funcionario_id, :valor_servico, :valor_comissao, :forma_pagamento, NOW(), NOW())');
        $insertStmt->execute([
            ':id' => uuid_v4(),
            ':agendamento_id' => $agendamentoId,
            ':funcionario_id' => $funcionarioId,
            ':valor_servico' => $valorServico,
            ':valor_comissao' => $valorComissao,
            ':forma_pagamento' => $formaPagamento,
        ]);
        return;
    }

    $insertStmt = db()->prepare('INSERT INTO transacoes_financeiras (id, agendamento_id, funcionario_id, valor_servico, valor_comissao, created_at, updated_at) VALUES (:id, :agendamento_id, :funcionario_id, :valor_servico, :valor_comissao, NOW(), NOW())');
    $insertStmt->execute([
        ':id' => uuid_v4(),
        ':agendamento_id' => $agendamentoId,
        ':funcionario_id' => $funcionarioId,
        ':valor_servico' => $valorServico,
        ':valor_comissao' => $valorComissao,
    ]);
}

function ensure_quitado_record(array $agendamento, ?string $formaPagamento = null): void {
    if (!has_column('quitados', 'agendamento_id')) {
        return;
    }

    $agendamentoId = (string)($agendamento['id'] ?? '');
    $servicoId = (string)($agendamento['servico_id'] ?? '');
    $clienteId = (string)($agendamento['cliente_id'] ?? '');
    if ($agendamentoId === '' || $servicoId === '' || $clienteId === '') {
        return;
    }

    $existsStmt = db()->prepare('SELECT id FROM quitados WHERE agendamento_id = :agendamento_id LIMIT 1');
    $existsStmt->execute([':agendamento_id' => $agendamentoId]);
    if ($existsStmt->fetch()) {
        return;
    }

    $funcionarioId = isset($agendamento['funcionario_id']) && $agendamento['funcionario_id'] ? (string)$agendamento['funcionario_id'] : null;
    [$valorServico, $valorComissao] = calculate_service_values($servicoId, $funcionarioId);
    $pagamento = $formaPagamento ?? ($agendamento['forma_pagamento'] ?? null);
    if ($pagamento === null || $pagamento === '' || $pagamento === 'em_aberto') {
        return;
    }

    $insertStmt = db()->prepare('INSERT INTO quitados (id, agendamento_id, cliente_id, servico_id, funcionario_id, funcionario, data_hora, valor_servico, valor_comissao, forma_pagamento, observacoes, data_quitacao, created_at, updated_at) VALUES (:id, :agendamento_id, :cliente_id, :servico_id, :funcionario_id, :funcionario, :data_hora, :valor_servico, :valor_comissao, :forma_pagamento, :observacoes, NOW(), NOW(), NOW())');
    $insertStmt->execute([
        ':id' => uuid_v4(),
        ':agendamento_id' => $agendamentoId,
        ':cliente_id' => $clienteId,
        ':servico_id' => $servicoId,
        ':funcionario_id' => $funcionarioId,
        ':funcionario' => isset($agendamento['funcionario']) ? (string)$agendamento['funcionario'] : '',
        ':data_hora' => (string)($agendamento['data_hora'] ?? date('Y-m-d H:i:s')),
        ':valor_servico' => $valorServico,
        ':valor_comissao' => $valorComissao,
        ':forma_pagamento' => $pagamento,
        ':observacoes' => $agendamento['observacoes'] ?? null,
    ]);
}

try {
    if ($action === 'select') {
        $compactColumns = preg_replace('/\s+/', '', $selectColumns);
        $selectClause = '*';
        if ($selectColumns !== '*' && !str_contains($selectColumns, '(')) {
            $requested = array_filter(array_map('trim', explode(',', preg_replace('/\s+/', ' ', $selectColumns))));
            $safe = [];
            foreach ($requested as $col) {
                if (preg_match('/^[a-zA-Z_][a-zA-Z0-9_]*$/', $col) && in_array($col, $allowedTables[$table], true)) {
                    $safe[] = "{$table}.{$col}";
                }
            }
            $selectClause = $safe ? implode(', ', $safe) : "{$table}.*";
        } else {
            $selectClause = "{$table}.*";
        }

        $joins = '';
        if ($table === 'agendamentos' && (str_contains($compactColumns, 'clientes(') || str_contains($compactColumns, 'clientes:'))) {
            $joins .= ' LEFT JOIN clientes ON clientes.id = agendamentos.cliente_id';
            $selectClause .= ', JSON_OBJECT("nome", clientes.nome) AS clientes';
        }
        if ($table === 'agendamentos' && (str_contains($compactColumns, 'servicos(') || str_contains($compactColumns, 'servicos:'))) {
            $joins .= ' LEFT JOIN servicos ON servicos.id = agendamentos.servico_id';
            $selectClause .= ', JSON_OBJECT("nome", servicos.nome, "preco", servicos.preco, "tempo_medio", servicos.tempo_medio) AS servicos';
        }
        if ($table === 'transacoes_financeiras' && (str_contains($compactColumns, 'funcionarios(') || str_contains($compactColumns, 'funcionarios:'))) {
            $joins .= ' LEFT JOIN funcionarios ON funcionarios.id = transacoes_financeiras.funcionario_id';
            $selectClause .= ', JSON_OBJECT("nome", funcionarios.nome) AS funcionarios';
        }
        if ($table === 'transacoes_financeiras' && (str_contains($compactColumns, 'agendamentos(') || str_contains($compactColumns, 'agendamentos:'))) {
            $joins .= ' LEFT JOIN agendamentos ON agendamentos.id = transacoes_financeiras.agendamento_id';
            $selectClause .= ', JSON_OBJECT("id", agendamentos.id, "forma_pagamento", ' . (has_column('agendamentos', 'forma_pagamento') ? 'agendamentos.forma_pagamento' : 'NULL') . ', "status", agendamentos.status, "data_hora", agendamentos.data_hora) AS agendamentos';
        }

        $sql = "SELECT {$selectClause} FROM {$table}{$joins}";
        $params = [];

        if (!$user && $table === 'funcionarios') {
            $filters[] = ['column' => 'ativo', 'operator' => 'eq', 'value' => 1];
        }

        if (is_array($filters) && count($filters) > 0) {
            $where = [];
            foreach ($filters as $i => $filter) {
                $column = (string)($filter['column'] ?? '');
                $op = map_operator((string)($filter['operator'] ?? 'eq'));

                if (!in_array($column, $allowedTables[$table], true)) {
                    continue;
                }

                $param = ":f{$i}";
                $where[] = "{$table}.{$column} {$op} {$param}";
                $params[$param] = $filter['value'];
            }

            if ($where) {
                $sql .= ' WHERE ' . implode(' AND ', $where);
            }
        }

        if (is_array($orderBy) && isset($orderBy['column']) && in_array($orderBy['column'], $allowedTables[$table], true)) {
            $direction = !empty($orderBy['ascending']) ? 'ASC' : 'DESC';
            $sql .= " ORDER BY {$table}.{$orderBy['column']} {$direction}";
        }

        if ($single || $maybeSingle) {
            $sql .= ' LIMIT 1';
        }

        $stmt = db()->prepare($sql);
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->execute();
        $data = $stmt->fetchAll();

        foreach ($data as &$row) {
            foreach (['clientes', 'servicos', 'funcionarios', 'agendamentos'] as $rel) {
                if (isset($row[$rel]) && is_string($row[$rel])) {
                    $decoded = json_decode($row[$rel], true);
                    $row[$rel] = is_array($decoded) ? $decoded : null;
                }
            }

            if (isset($row['preco'])) {
                $row['preco'] = (float)$row['preco'];
            }
            if (isset($row['tempo_medio'])) {
                $row['tempo_medio'] = (int)$row['tempo_medio'];
            }
            if (isset($row['valor_servico'])) {
                $row['valor_servico'] = (float)$row['valor_servico'];
            }
            if (isset($row['valor_comissao'])) {
                $row['valor_comissao'] = (float)$row['valor_comissao'];
            }
            if (isset($row['servicos']) && is_array($row['servicos'])) {
                if (isset($row['servicos']['preco'])) {
                    $row['servicos']['preco'] = (float)$row['servicos']['preco'];
                }
                if (isset($row['servicos']['tempo_medio'])) {
                    $row['servicos']['tempo_medio'] = (int)$row['servicos']['tempo_medio'];
                }
            }

            if (isset($row['dias_funcionamento']) && is_string($row['dias_funcionamento'])) {
                $decoded = json_decode($row['dias_funcionamento'], true);
                if (is_array($decoded)) {
                    $row['dias_funcionamento'] = $decoded;
                }
            }
        }

        if ($single || $maybeSingle) {
            $singleRow = $data[0] ?? null;
            if (!$singleRow && $single) {
                respond(['data' => null, 'error' => ['message' => 'Registro não encontrado']], 404);
            }
            respond(['data' => $singleRow, 'error' => null]);
        }

        respond(['data' => $data, 'error' => null]);
    }

    if ($action === 'insert') {
        if (!is_array($rows) || count($rows) === 0) {
            respond(['data' => null, 'error' => ['message' => 'rows é obrigatório']], 422);
        }

        $inserted = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $columns = [];
            $holders = [];
            $params = [];

            foreach ($row as $col => $val) {
                if (!in_array($col, $allowedTables[$table], true)) continue;
                $columns[] = $col;
                $holders[] = ':' . $col;
                if ($col === 'dias_funcionamento' && is_array($val)) {
                    $params[':' . $col] = json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                } else {
                    $params[':' . $col] = $val;
                }
            }

            if (!in_array('id', $columns, true)) {
                $columns[] = 'id';
                $holders[] = ':id';
                $params[':id'] = uuid_v4();
            }

            $sql = 'INSERT INTO ' . $table . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $holders) . ')';
            $stmt = db()->prepare($sql);
            $stmt->execute($params);

            $id = $params[':id'] ?? null;
            if ($id) {
                $rowStmt = db()->prepare('SELECT * FROM ' . $table . ' WHERE id = :id LIMIT 1');
                $rowStmt->execute([':id' => $id]);
                $found = $rowStmt->fetch();
                if ($found) {
                    if (isset($found['dias_funcionamento']) && is_string($found['dias_funcionamento'])) {
                        $decoded = json_decode($found['dias_funcionamento'], true);
                        if (is_array($decoded)) $found['dias_funcionamento'] = $decoded;
                    }

                    if (
                        $table === 'agendamentos' &&
                        isset($found['status']) && is_finished_status((string)$found['status']) &&
                        isset($found['servico_id'])
                    ) {
                        ensure_financial_transaction(
                            (string)$found['id'],
                            (string)$found['servico_id'],
                            isset($found['funcionario_id']) && $found['funcionario_id'] ? (string)$found['funcionario_id'] : null,
                            isset($found['forma_pagamento']) ? (string)$found['forma_pagamento'] : null
                        );

                        if (is_paid_status((string)$found['status'])) {
                            ensure_quitado_record($found, isset($found['forma_pagamento']) ? (string)$found['forma_pagamento'] : null);
                        }
                    }

                    $inserted[] = $found;
                }
            }
        }

        respond(['data' => $inserted, 'error' => null]);
    }

    if ($action === 'update') {
        if (!is_array($values) || count($values) === 0) {
            respond(['data' => null, 'error' => ['message' => 'values é obrigatório']], 422);
        }

        $sets = [];
        $params = [];
        foreach ($values as $col => $val) {
            if (!in_array($col, $allowedTables[$table], true)) continue;
            $param = ':v_' . $col;
            $sets[] = "{$col} = {$param}";
            $params[$param] = ($col === 'dias_funcionamento' && is_array($val))
                ? json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                : $val;
        }

        if (!$sets) {
            respond(['data' => null, 'error' => ['message' => 'Nenhuma coluna válida para update']], 422);
        }

        $sql = "UPDATE {$table} SET " . implode(', ', $sets);
        $where = [];
        foreach ($filters as $i => $filter) {
            $column = (string)($filter['column'] ?? '');
            if (!in_array($column, $allowedTables[$table], true)) continue;
            $op = map_operator((string)($filter['operator'] ?? 'eq'));
            $param = ":f{$i}";
            $where[] = "{$column} {$op} {$param}";
            $params[$param] = $filter['value'];
        }

        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $stmt = db()->prepare($sql);
        $stmt->execute($params);

        if ($table === 'agendamentos' && isset($values['status']) && is_finished_status((string)$values['status'])) {
            $selectSql = "SELECT id, cliente_id, servico_id, funcionario_id, funcionario, data_hora, observacoes" . (has_column('agendamentos', 'forma_pagamento') ? ", forma_pagamento" : "") . " FROM agendamentos";
            if ($where) {
                $selectSql .= ' WHERE ' . implode(' AND ', $where) . " AND status IN ('concluido', 'concluído', 'quitado')";
            } else {
                $selectSql .= " WHERE status IN ('concluido', 'concluído', 'quitado')";
            }

            $selectStmt = db()->prepare($selectSql);
            foreach ($params as $key => $value) {
                if (str_starts_with($key, ':f')) {
                    $selectStmt->bindValue($key, $value);
                }
            }
            $selectStmt->execute();
            $agendamentosConcluidos = $selectStmt->fetchAll();

            foreach ($agendamentosConcluidos as $agendamento) {
                ensure_financial_transaction(
                    (string)$agendamento['id'],
                    (string)$agendamento['servico_id'],
                    $agendamento['funcionario_id'] ? (string)$agendamento['funcionario_id'] : null,
                    isset($agendamento['forma_pagamento']) ? (string)$agendamento['forma_pagamento'] : null
                );

                if (is_paid_status((string)$values['status'])) {
                    ensure_quitado_record($agendamento, isset($agendamento['forma_pagamento']) ? (string)$agendamento['forma_pagamento'] : null);
                }
            }
        }

        respond(['data' => ['affected' => $stmt->rowCount()], 'error' => null]);
    }

    if ($action === 'delete') {
        $sql = "DELETE FROM {$table}";
        $params = [];
        $where = [];

        foreach ($filters as $i => $filter) {
            $column = (string)($filter['column'] ?? '');
            if (!in_array($column, $allowedTables[$table], true)) continue;
            $op = map_operator((string)($filter['operator'] ?? 'eq'));
            $param = ":f{$i}";
            $where[] = "{$column} {$op} {$param}";
            $params[$param] = $filter['value'];
        }

        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        respond(['data' => ['affected' => $stmt->rowCount()], 'error' => null]);
    }

    respond(['data' => null, 'error' => ['message' => 'Ação inválida']], 422);
} catch (Throwable $e) {
    respond(['data' => null, 'error' => ['message' => $e->getMessage()]], 500);
}
