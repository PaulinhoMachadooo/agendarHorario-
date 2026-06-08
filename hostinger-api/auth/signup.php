<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$input = json_body();
$email = strtolower(trim((string)($input['email'] ?? '')));
$password = (string)($input['password'] ?? '');
$metadata = $input['metadata'] ?? [];

if (!$email || !$password) {
    respond(['data' => null, 'error' => ['message' => 'Email e senha são obrigatórios.']], 422);
}

if (strlen($password) < 6) {
    respond(['data' => null, 'error' => ['message' => 'A senha deve ter no mínimo 6 caracteres.']], 422);
}

try {
    $check = db()->prepare('SELECT id FROM auth_users WHERE email = :email LIMIT 1');
    $check->execute([':email' => $email]);
    if ($check->fetch()) {
        respond(['data' => null, 'error' => ['message' => 'User already registered']], 409);
    }

    $id = uuid_v4();
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $metaColumn = auth_metadata_column();
    $metaJson = json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $insert = db()->prepare("INSERT INTO auth_users (id, email, password_hash, {$metaColumn}) VALUES (:id, :email, :password_hash, :metadata)");
    $insert->execute([
        ':id' => $id,
        ':email' => $email,
        ':password_hash' => $hash,
        ':metadata' => $metaJson,
    ]);

    $session = create_session($id);

    respond([
        'data' => [
            'user' => [
                'id' => $id,
                'email' => $email,
                'user_metadata' => $metadata,
            ],
            'session' => [
                'access_token' => $session['access_token'],
                'user' => [
                    'id' => $id,
                    'email' => $email,
                    'user_metadata' => $metadata,
                ],
            ],
        ],
        'error' => null,
    ]);
} catch (Throwable $e) {
    respond(['data' => null, 'error' => ['message' => $e->getMessage()]], 500);
}
