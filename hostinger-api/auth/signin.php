<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$input = json_body();
$email = strtolower(trim((string)($input['email'] ?? '')));
$password = (string)($input['password'] ?? '');
$isClienteEmail = substr($email, -strlen('@cliente.barbearia.com')) === '@cliente.barbearia.com';
$isPasswordlessClienteLogin = $isClienteEmail && $password === '';

if (!$email) {
    respond(['data' => null, 'error' => ['message' => 'Email é obrigatório.']], 422);
}

if (!$password && !$isPasswordlessClienteLogin) {
    respond(['data' => null, 'error' => ['message' => 'Email e senha são obrigatórios.']], 422);
}

try {
    $stmt = db()->prepare('SELECT * FROM auth_users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        respond(['data' => null, 'error' => ['message' => 'Credenciais inválidas']], 401);
    }

    $metaColumn = auth_metadata_column();
    $metadata = json_decode($user[$metaColumn] ?? '{}', true);
    $metadata = is_array($metadata) ? $metadata : [];
    $isClienteUser = ($metadata['tipo_usuario'] ?? null) === 'cliente' || ($metadata['user_type'] ?? null) === 'cliente';

    if ($isPasswordlessClienteLogin && !$isClienteUser) {
        $clienteStmt = db()->prepare('SELECT id FROM clientes WHERE user_id = :user_id LIMIT 1');
        $clienteStmt->execute([':user_id' => $user['id']]);
        $isClienteUser = (bool)$clienteStmt->fetch();
    }

    if ($isPasswordlessClienteLogin) {
        if (!$isClienteUser) {
            respond(['data' => null, 'error' => ['message' => 'Credenciais inválidas']], 401);
        }
    } elseif (!password_verify($password, $user['password_hash'])) {
        respond(['data' => null, 'error' => ['message' => 'Credenciais inválidas']], 401);
    }

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
