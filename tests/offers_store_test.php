<?php
declare(strict_types=1);

require_once __DIR__ . '/../OfferStore.php';

function expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$directory = sys_get_temp_dir() . '/spotmanager-offers-test-' . bin2hex(random_bytes(6));
if (!mkdir($directory, 0700)) {
    throw new RuntimeException('Impossible de créer le dossier temporaire du test.');
}
$databasePath = $directory . '/offers.sqlite';

try {
    $store = new OfferStore($databasePath);
    expect(count($store->all()) === 9, 'Les neuf offres par défaut doivent être insérées une seule fois.');

    $duplicate = [
        'price' => 100,
        'durationDays' => 1,
        'quotaTenths' => 20,
        'active' => false,
        'portal' => true,
    ];
    expect($store->hasDuplicate($duplicate), 'Le statut actif ne doit pas autoriser un doublon.');

    $created = $store->create([
        'price' => 450,
        'durationDays' => 3,
        'quotaTenths' => 125,
        'active' => true,
        'portal' => true,
    ]);
    expect(preg_match('/^[a-f0-9]{32}$/', $created['shareId']) === 1, 'Le lien doit avoir un identifiant aléatoire unique.');
    expect($store->hasDuplicate([
        'price' => 450,
        'durationDays' => 3,
        'quotaTenths' => 125,
        'active' => false,
        'portal' => true,
    ]), 'Le contenu nouvellement créé doit être unique.');
    expect($store->byShareId($created['shareId'])['id'] === $created['id'], 'Le lien doit retrouver son offre active.');

    $updated = $store->update($created['id'], [
        'price' => 500,
        'durationDays' => 3,
        'quotaTenths' => 125,
        'active' => false,
        'portal' => true,
    ]);
    expect($updated['shareId'] === $created['shareId'], 'Modifier une offre doit conserver son lien.');
    expect($store->byShareId($created['shareId']) === null, 'Une offre inactive ne doit pas être partageable.');
    expect($store->delete($created['id']), 'Une offre existante doit pouvoir être supprimée.');
    expect(!$store->delete($created['id']), 'Une offre supprimée ne doit pas pouvoir l’être une seconde fois.');
    unset($store);
} finally {
    foreach ([$databasePath, $databasePath . '-wal', $databasePath . '-shm'] as $file) {
        if (is_file($file)) unlink($file);
    }
    rmdir($directory);
}

echo "OfferStore tests: OK\n";
