<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$input = json_body();
$email = strtolower(trim((string)($input['email'] ?? '')));
$password = (string)($input['password'] ?? '');

if (!$email || !$password) {
    respond(['data' => null, 'error' => ['message' => 'Email e senha são obrigatórios.']], 422);
}

try {
    $stmt = db()->prepare('SELECT * FROM auth_users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        respond(['data' => null, 'error' => ['message' => 'Credenciais inválidas']], 401);
    }

    $metaColumn = auth_metadata_column();
    $metadata = json_decode($user[$metaColumn] ?? '{}', true);
    $metadata = is_array($metadata) ? $metadata : [];

    $session = create_session($user['id']);

    respond([
        'data' => [
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'user_metadata' => $metadata,
            ],
            'session' => [
                'access_token' => $session['access_token'],
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'user_metadata' => $metadata,
                ],
            ],
        ],
        'error' => null,
    ]);
} catch (Throwable $e) {
    respond(['data' => null, 'error' => ['message' => $e->getMessage()]], 500);
}
