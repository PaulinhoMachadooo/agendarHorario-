<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function load_local_env(): void {
    static $loaded = false;
    if ($loaded) {
        return;
    }

    foreach ([__DIR__ . '/.env.local', __DIR__ . '/.env'] as $file) {
        if (!is_readable($file)) {
            continue;
        }

        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!$lines) {
            continue;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = array_map('trim', explode('=', $line, 2));
            if ($key === '') {
                continue;
            }

            $value = trim($value, " \t\n\r\0\x0B\"'");
            if (getenv($key) === false && !array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $value;
                putenv("{$key}={$value}");
            }
        }
    }

    $loaded = true;
}

function env_value(string $key, ?string $default = null): ?string {
    load_local_env();
    $value = $_ENV[$key] ?? getenv($key);
    return $value === false || $value === null ? $default : (string)$value;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = env_value('DB_HOST', env_value('MYSQL_HOST', '127.0.0.1'));
    $port = env_value('DB_PORT', env_value('MYSQL_PORT', '3306'));
    $name = env_value('DB_DATABASE', env_value('DB_NAME', env_value('MYSQL_DATABASE', 'u278136558_AgendaFran')));
    $user = env_value('DB_USERNAME', env_value('DB_USER', env_value('MYSQL_USER', 'u278136558_fran')));
    $pass = env_value('DB_PASSWORD', env_value('DB_PASS', env_value('MYSQL_PASSWORD', 'Oluap.125874')));

    if ($pass === '' && $user !== 'root') {
        throw new RuntimeException('DB_PASSWORD não configurada para o usuário do banco. Crie hostinger-api/.env com DB_HOST, DB_DATABASE, DB_USERNAME e DB_PASSWORD ou configure essas variáveis no servidor.');
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}


function ensure_auth_tables(): void {
    static $ensured = false;
    if ($ensured) {
        return;
    }

    db()->exec("CREATE TABLE IF NOT EXISTS auth_users (
        id CHAR(36) NOT NULL PRIMARY KEY,
        email VARCHAR(180) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        user_metadata LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    db()->exec("CREATE TABLE IF NOT EXISTS auth_sessions (
        token VARCHAR(128) NOT NULL PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_auth_sessions_user_id (user_id),
        INDEX idx_auth_sessions_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $fkSql = "SELECT CONSTRAINT_NAME
              FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'auth_sessions'
                AND CONSTRAINT_TYPE = 'FOREIGN KEY'
                AND CONSTRAINT_NAME = 'fk_auth_sessions_user'
              LIMIT 1";
    $hasFk = db()->query($fkSql)->fetchColumn();
    if (!$hasFk) {
        try {
            db()->exec("ALTER TABLE auth_sessions
                ADD CONSTRAINT fk_auth_sessions_user
                FOREIGN KEY (user_id) REFERENCES auth_users(id)
                ON DELETE CASCADE ON UPDATE CASCADE");
        } catch (Throwable $e) {
            // Some shared hosts may reject ALTER TABLE for constraints; the auth flow still works without this FK.
        }
    }

    $ensured = true;
}

function json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function bearer_token(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) {
        return null;
    }

    return trim(substr($header, 7));
}

function uuid_v4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}


function auth_metadata_column(): string {
    ensure_auth_tables();
    static $column = null;
    if ($column !== null) {
        return $column;
    }

    $sql = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth_users' AND COLUMN_NAME IN ('user_metadata', 'metadata') ORDER BY FIELD(COLUMN_NAME, 'user_metadata', 'metadata') LIMIT 1";
    $stmt = db()->query($sql);
    $found = $stmt->fetchColumn();

    $column = $found ?: 'user_metadata';
    return $column;
}

function create_session(string $userId): array {
    ensure_auth_tables();
    $token = bin2hex(random_bytes(32));
    $expiresAt = (new DateTimeImmutable('+7 days'))->format('Y-m-d H:i:s');

    $sql = 'INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (:token, :user_id, :expires_at)';
    $stmt = db()->prepare($sql);
    $stmt->execute([
        ':token' => $token,
        ':user_id' => $userId,
        ':expires_at' => $expiresAt,
    ]);

    return [
        'access_token' => $token,
        'expires_at' => $expiresAt,
    ];
}

function current_user(): ?array {
    ensure_auth_tables();
    $token = bearer_token();
    if (!$token) {
        return null;
    }

    $sql = 'SELECT u.*
            FROM auth_sessions s
            JOIN auth_users u ON u.id = s.user_id
            WHERE s.token = :token AND s.expires_at > NOW()';

    $stmt = db()->prepare($sql);
    $stmt->execute([':token' => $token]);
    $user = $stmt->fetch();

    if (!$user) {
        return null;
    }

    $metaColumn = auth_metadata_column();
    $metadata = json_decode($user[$metaColumn] ?? '{}', true);

    return [
        'id' => $user['id'],
        'email' => $user['email'],
        'user_metadata' => is_array($metadata) ? $metadata : new stdClass(),
    ];
}