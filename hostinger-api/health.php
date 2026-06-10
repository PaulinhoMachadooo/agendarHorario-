<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

$startedAt = microtime(true);

try {
    $pdo = db();
    $ping = $pdo->query('SELECT 1 AS ok, DATABASE() AS current_database, VERSION() AS mysql_version')->fetch();

    $tables = ['auth_users', 'auth_sessions', 'clientes', 'servicos', 'funcionarios', 'agendamentos', 'transacoes_financeiras', 'quitados'];
    $tableStatus = [];
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name');

    foreach ($tables as $table) {
        $stmt->execute([':table_name' => $table]);
        $tableStatus[$table] = ((int)$stmt->fetchColumn()) > 0;
    }

    respond([
        'data' => [
            'status' => 'ok',
            'php_version' => PHP_VERSION,
            'database' => [
                'connected' => true,
                'current_database' => $ping['current_database'] ?? null,
                'mysql_version' => $ping['mysql_version'] ?? null,
                'settings' => safe_db_settings(),
                'tables' => $tableStatus,
            ],
            'elapsed_ms' => (int)round((microtime(true) - $startedAt) * 1000),
        ],
        'error' => null,
    ]);
} catch (Throwable $e) {
    respond([
        'data' => [
            'status' => 'error',
            'php_version' => PHP_VERSION,
            'database' => [
                'connected' => false,
                'settings' => safe_db_settings(),
            ],
            'elapsed_ms' => (int)round((microtime(true) - $startedAt) * 1000),
        ],
        'error' => [
            'message' => $e->getMessage(),
            'type' => get_class($e),
        ],
    ], 500);
}
