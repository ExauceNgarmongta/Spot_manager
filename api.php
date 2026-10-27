<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function durationSeconds(?string $duration): ?int
{
    if (!$duration) return null;
    if (preg_match('/^(\d+):(\d{2}):(\d{2})$/', $duration, $parts)) {
        return ((int) $parts[1] * 3600) + ((int) $parts[2] * 60) + (int) $parts[3];
    }
    preg_match_all('/(\d+)(w|d|h|m|s)/i', $duration, $parts, PREG_SET_ORDER);
    if (!$parts) return null;
    $units = ['w' => 604800, 'd' => 86400, 'h' => 3600, 'm' => 60, 's' => 1];
    $seconds = 0;
    foreach ($parts as $part) {
        $seconds += (int) $part[1] * $units[strtolower($part[2])];
    }
    return $seconds;
}

function formatDuration(?int $seconds): string
{
    if ($seconds === null) return '—';
    $seconds = max(0, $seconds);
    $days = intdiv($seconds, 86400);
    $hours = intdiv($seconds % 86400, 3600);
    $minutes = intdiv($seconds % 3600, 60);
    if ($days > 0) return $days . ' j ' . $hours . ' h';
    if ($hours > 0) return $hours . ' h ' . $minutes . ' min';
    return $minutes . ' min';
}

$configPath = __DIR__ . '/config.local.php';
if (!is_file($configPath)) {
    respond(503, ['error' => 'Configuration absente : créez config.local.php à partir de config.example.php.']);
}

$config = require $configPath;
$adminToken = (string) ($config['admin_token'] ?? '');
if ($adminToken === '' || $adminToken === 'REMPLACER_PAR_UN_JETON_ALEATOIRE_LONG') {
    respond(503, ['error' => 'Définissez un jeton administrateur dans config.local.php.']);
}

$providedToken = (string) ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
if ($providedToken === '' || !hash_equals($adminToken, $providedToken)) {
    respond(401, ['error' => 'Jeton administrateur invalide.']);
}

if (!extension_loaded('curl')) {
    respond(503, ['error' => 'L’extension PHP cURL est requise pour contacter le routeur.']);
}

$routerConfig = $config['router'] ?? [];
foreach (['host', 'user', 'password'] as $key) {
    if (empty($routerConfig[$key])) {
        respond(503, ['error' => 'La configuration du routeur est incomplète.']);
    }
}

require_once __DIR__ . '/MikrotikClient.php';
$client = new MikrotikClient(
    (string) $routerConfig['host'],
    (string) $routerConfig['user'],
    (string) $routerConfig['password'],
    (bool) ($routerConfig['verify_tls'] ?? false)
);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string) ($_GET['action'] ?? '');
$input = [];
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input') ?: '', true) ?? [];
    if (!is_array($input)) respond(400, ['error' => 'Corps JSON invalide.']);
}

try {
    if ($method === 'GET' && $action === 'overview') {
        $health = $client->health();
        $sessions = [];
        foreach ($client->activeSessions() as $active) {
            $username = (string) ($active['user'] ?? '');
            if ($username === '') continue;
            $user = $client->getUser($username) ?? [];
            $usedBytes = (int) ($user['bytes-in'] ?? $active['bytes-in'] ?? 0)
                + (int) ($user['bytes-out'] ?? $active['bytes-out'] ?? 0);
            $quotaBytes = (int) ($user['limit-bytes-total'] ?? 0);
            $limitSeconds = durationSeconds(isset($user['limit-uptime']) ? (string) $user['limit-uptime'] : null);
            $uptimeSeconds = durationSeconds(isset($active['uptime']) ? (string) $active['uptime'] : null);
            $sessions[] = [
                'id' => (string) ($active['.id'] ?? $username),
                'username' => $username,
                'profile' => (string) ($user['profile'] ?? '—'),
                'remaining' => $limitSeconds !== null && $uptimeSeconds !== null
                    ? formatDuration($limitSeconds - $uptimeSeconds)
                    : '—',
                'used' => round($usedBytes / 1048576, 1),
                'quota' => $quotaBytes > 0 ? round($quotaBytes / 1048576, 1) : null,
            ];
        }

        respond(200, [
            'router' => [
                'id' => 'configured-router',
                'name' => (string) ($routerConfig['name'] ?? 'Routeur MikroTik'),
                'host' => (string) $routerConfig['host'],
                'location' => (string) ($routerConfig['location'] ?? 'Non renseigné'),
                'online' => true,
                'version' => (string) ($health['version'] ?? 'RouterOS'),
            ],
            'sessions' => $sessions,
        ]);
    }

    if ($method === 'GET' && $action === 'tickets') {
        $activeByUsername = [];
        foreach ($client->activeSessions() as $active) {
            $username = (string) ($active['user'] ?? '');
            if ($username !== '') $activeByUsername[$username] = $active;
        }
        $tickets = [];
        foreach ($client->users() as $user) {
            $username = (string) ($user['name'] ?? '');
            if ($username === '') continue;
            $active = $activeByUsername[$username] ?? [];
            $usedBytes = (int) ($user['bytes-in'] ?? $active['bytes-in'] ?? 0)
                + (int) ($user['bytes-out'] ?? $active['bytes-out'] ?? 0);
            $quotaBytes = (int) ($user['limit-bytes-total'] ?? 0);
            $limitSeconds = durationSeconds(isset($user['limit-uptime']) ? (string) $user['limit-uptime'] : null);
            $usedSeconds = durationSeconds(isset($user['uptime']) ? (string) $user['uptime'] : null)
                ?? durationSeconds(isset($active['uptime']) ? (string) $active['uptime'] : null);
            $remainingSeconds = $limitSeconds !== null && $usedSeconds !== null
                ? $limitSeconds - $usedSeconds
                : null;
            $tickets[] = [
                'username' => $username,
                'profile' => (string) ($user['profile'] ?? '—'),
                'comment' => (string) ($user['comment'] ?? ''),
                'active' => $active !== [],
                'usedMb' => round($usedBytes / 1048576, 1),
                'quotaMb' => $quotaBytes > 0 ? round($quotaBytes / 1048576, 1) : null,
                'timeExpired' => $remainingSeconds !== null && $remainingSeconds <= 0,
                'remaining' => $remainingSeconds !== null
                    ? formatDuration($remainingSeconds)
                    : '—',
            ];
        }
        respond(200, ['tickets' => $tickets]);
    }

    if ($method === 'POST' && $action === 'create_user') {
        foreach (['username', 'password', 'profile', 'limitUptime', 'limitBytes'] as $key) {
            if (!isset($input[$key]) || trim((string) $input[$key]) === '') {
                respond(422, ['error' => 'Tous les champs de création sont obligatoires.']);
            }
        }
        $created = $client->createUser(
            trim((string) $input['username']),
            (string) $input['password'],
            trim((string) $input['profile']),
            trim((string) $input['limitUptime']),
            trim((string) $input['limitBytes'])
        );
        respond(201, ['created' => true, 'user' => $created]);
    }

    if ($method === 'POST' && $action === 'disconnect') {
        $username = trim((string) ($input['username'] ?? ''));
        if ($username === '') respond(422, ['error' => 'Identifiant hotspot manquant.']);
        respond(200, ['disconnected' => $client->disconnect($username)]);
    }

    respond(404, ['error' => 'Action inconnue.']);
} catch (Throwable $error) {
    respond(502, ['error' => $error->getMessage()]);
}