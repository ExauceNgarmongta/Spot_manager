<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function offersRespond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function parseOffer(array $input): array
{
    $price = filter_var($input['price'] ?? null, FILTER_VALIDATE_INT);
    $durationDays = filter_var($input['durationDays'] ?? null, FILTER_VALIDATE_INT);
    $rawQuota = $input['quotaGb'] ?? null;
    $quotaTenths = null;

    if ($rawQuota !== null) {
        if (!is_numeric($rawQuota) || !is_finite((float) $rawQuota)) {
            offersRespond(422, ['error' => 'Le volume doit être un nombre positif ou illimité.']);
        }
        $scaledQuota = (float) $rawQuota * 10;
        if ($scaledQuota <= 0 || abs($scaledQuota - round($scaledQuota)) > 0.000001) {
            offersRespond(422, ['error' => 'Le volume doit être positif et limité à une décimale.']);
        }
        $quotaTenths = (int) round($scaledQuota);
    }

    if ($price === false || $price < 1 || $price > 100000000) {
        offersRespond(422, ['error' => 'Le prix doit être un entier positif.']);
    }
    if ($durationDays === false || $durationDays < 1 || $durationDays > 3650) {
        offersRespond(422, ['error' => 'La durée doit être comprise entre 1 et 3650 jours.']);
    }
    if ($quotaTenths !== null && $quotaTenths > 1000000000) {
        offersRespond(422, ['error' => 'Le volume demandé est trop élevé.']);
    }
    if (isset($input['active']) && !is_bool($input['active'])) {
        offersRespond(422, ['error' => 'Le statut de l’offre est invalide.']);
    }

    return [
        'price' => $price,
        'durationDays' => $durationDays,
        'quotaTenths' => $quotaTenths,
        'active' => $input['active'] ?? true,
        'portal' => true,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string) ($_GET['action'] ?? '');
$isPublicOfferRequest = $method === 'GET' && $action === 'public';

if (!$isPublicOfferRequest) {
    $configPath = __DIR__ . '/config.local.php';
    if (!is_file($configPath)) {
        offersRespond(503, ['error' => 'Configuration absente : créez config.local.php à partir de config.example.php.']);
    }
    $config = require $configPath;
    $adminToken = (string) ($config['admin_token'] ?? '');
    if ($adminToken === '' || $adminToken === 'REMPLACER_PAR_UN_JETON_ALEATOIRE_LONG') {
        offersRespond(503, ['error' => 'Définissez un jeton administrateur dans config.local.php.']);
    }
    $providedToken = (string) ($_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '');
    if ($providedToken === '' || !hash_equals($adminToken, $providedToken)) {
        offersRespond(401, ['error' => 'Jeton administrateur invalide.']);
    }
} else {
    $configPath = __DIR__ . '/config.local.php';
    $config = is_file($configPath) ? require $configPath : [];
}

$defaultDatabasePath = dirname(__DIR__) . '/spotmanager-data/offers.sqlite';
$databasePath = (string) ($config['offers_db_path'] ?? $defaultDatabasePath);
if ($databasePath === '') {
    offersRespond(503, ['error' => 'Le chemin de la base des offres est invalide.']);
}

require_once __DIR__ . '/OfferStore.php';

try {
    $store = new OfferStore($databasePath);
    if ($isPublicOfferRequest) {
        $shareId = (string) ($_GET['id'] ?? '');
        if (!preg_match('/^[a-f0-9]{32}$/', $shareId)) {
            offersRespond(404, ['error' => 'Cette offre n’existe pas ou n’est plus active.']);
        }
        $offer = $store->byShareId($shareId);
        if (!$offer) offersRespond(404, ['error' => 'Cette offre n’existe pas ou n’est plus active.']);
        offersRespond(200, ['offer' => $offer]);
    }

    if ($method === 'GET' && $action === 'list') {
        offersRespond(200, ['offers' => $store->all()]);
    }

    if ($method !== 'POST') {
        offersRespond(405, ['error' => 'Méthode non autorisée.']);
    }
    $input = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($input)) offersRespond(400, ['error' => 'Corps JSON invalide.']);

    if ($action === 'create') {
        $offer = parseOffer($input);
        if ($store->hasDuplicate($offer)) {
            offersRespond(409, ['error' => 'Une offre avec le même prix, la même durée et le même volume existe déjà.']);
        }
        try {
            $created = $store->create($offer);
        } catch (PDOException $error) {
            if (str_contains($error->getMessage(), 'UNIQUE constraint failed: offers.content_key')) {
                offersRespond(409, ['error' => 'Une offre avec le même prix, la même durée et le même volume existe déjà.']);
            }
            throw $error;
        }
        offersRespond(201, ['offer' => $created]);
    }

    if ($action === 'update') {
        $id = (string) ($input['id'] ?? '');
        if (!preg_match('/^[a-f0-9]{32}$/', $id)) {
            offersRespond(422, ['error' => 'Identifiant d’offre invalide.']);
        }
        $offer = parseOffer($input);
        if ($store->hasDuplicate($offer, $id)) {
            offersRespond(409, ['error' => 'Une offre avec le même prix, la même durée et le même volume existe déjà.']);
        }
        try {
            $updated = $store->update($id, $offer);
        } catch (PDOException $error) {
            if (str_contains($error->getMessage(), 'UNIQUE constraint failed: offers.content_key')) {
                offersRespond(409, ['error' => 'Une offre avec le même prix, la même durée et le même volume existe déjà.']);
            }
            throw $error;
        }
        if (!$updated) offersRespond(404, ['error' => 'Offre introuvable.']);
        offersRespond(200, ['offer' => $updated]);
    }

    if ($action === 'delete') {
        $id = (string) ($input['id'] ?? '');
        if (!preg_match('/^[a-f0-9]{32}$/', $id)) {
            offersRespond(422, ['error' => 'Identifiant d’offre invalide.']);
        }
        if (!$store->delete($id)) offersRespond(404, ['error' => 'Offre introuvable.']);
        offersRespond(200, ['deleted' => true]);
    }

    offersRespond(404, ['error' => 'Action inconnue.']);
} catch (Throwable $error) {
    error_log('SpotManager offers API: ' . $error->getMessage());
    offersRespond(500, ['error' => 'Erreur lors de l’accès à la base des offres.']);
}
