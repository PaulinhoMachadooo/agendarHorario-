<?php

declare(strict_types=1);

require_once __DIR__ . '/../config.php';

$token = bearer_token();
if ($token) {
    $stmt = db()->prepare('DELETE FROM auth_sessions WHERE token = :token');
    $stmt->execute([':token' => $token]);
}

respond(['data' => ['success' => true], 'error' => null]);
