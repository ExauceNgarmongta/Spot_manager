<?php
declare(strict_types=1);

final class OfferStore
{
    private PDO $database;

    public function __construct(string $databasePath)
    {
        $directory = dirname($databasePath);
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Impossible de créer le dossier de la base des offres.');
        }

        $this->database = new PDO('sqlite:' . $databasePath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $this->database->exec('PRAGMA busy_timeout = 5000');
        $this->database->exec('PRAGMA journal_mode = WAL');
        @chmod($databasePath, 0600);

        $this->migrate();
        $this->seedDefaultsOnce();
    }

    public function all(): array
    {
        $rows = $this->database->query(
            'SELECT id, share_id, price, duration_days, quota_tenths, active, portal
             FROM offers ORDER BY price ASC, duration_days ASC, id ASC'
        )->fetchAll();
        return array_map([$this, 'toOffer'], $rows);
    }

    public function byShareId(string $shareId): ?array
    {
        $statement = $this->database->prepare(
            'SELECT id, share_id, price, duration_days, quota_tenths, active, portal
             FROM offers WHERE share_id = :share_id AND active = 1'
        );
        $statement->execute(['share_id' => $shareId]);
        $row = $statement->fetch();
        return $row ? $this->toOffer($row) : null;
    }

    public function hasDuplicate(array $offer, ?string $exceptId = null): bool
    {
        $sql = 'SELECT 1 FROM offers WHERE content_key = :content_key';
        $parameters = ['content_key' => $this->contentKey($offer)];
        if ($exceptId !== null) {
            $sql .= ' AND id <> :id';
            $parameters['id'] = $exceptId;
        }
        $statement = $this->database->prepare($sql . ' LIMIT 1');
        $statement->execute($parameters);
        return (bool) $statement->fetchColumn();
    }

    public function create(array $offer): array
    {
        $id = bin2hex(random_bytes(16));
        $shareId = bin2hex(random_bytes(16));
        $statement = $this->database->prepare(
            'INSERT INTO offers
                (id, share_id, price, duration_days, quota_tenths, active, portal, content_key)
             VALUES
                (:id, :share_id, :price, :duration_days, :quota_tenths, :active, :portal, :content_key)'
        );
        $statement->execute($this->parameters($offer, $id, $shareId));
        return $this->byId($id);
    }

    public function update(string $id, array $offer): ?array
    {
        if (!$this->byId($id)) return null;
        $statement = $this->database->prepare(
            'UPDATE offers
             SET price = :price, duration_days = :duration_days, quota_tenths = :quota_tenths,
                 active = :active, portal = :portal, content_key = :content_key,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $statement->execute($this->parameters($offer, $id, null));
        return $this->byId($id);
    }

    public function delete(string $id): bool
    {
        $statement = $this->database->prepare('DELETE FROM offers WHERE id = :id');
        $statement->execute(['id' => $id]);
        return $statement->rowCount() > 0;
    }

    private function migrate(): void
    {
        $this->database->exec(
            'CREATE TABLE IF NOT EXISTS offers (
                id TEXT PRIMARY KEY,
                share_id TEXT NOT NULL UNIQUE,
                price INTEGER NOT NULL CHECK (price > 0),
                duration_days INTEGER NOT NULL CHECK (duration_days > 0),
                quota_tenths INTEGER NULL CHECK (quota_tenths IS NULL OR quota_tenths > 0),
                active INTEGER NOT NULL CHECK (active IN (0, 1)),
                portal INTEGER NOT NULL CHECK (portal IN (0, 1)),
                content_key TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )'
        );
        $this->database->exec(
            'CREATE TABLE IF NOT EXISTS offers_meta (
                meta_key TEXT PRIMARY KEY,
                meta_value TEXT NOT NULL
            )'
        );
    }

    private function seedDefaultsOnce(): void
    {
        $seeded = $this->database->query(
            "SELECT 1 FROM offers_meta WHERE meta_key = 'default_offers_seeded'"
        )->fetchColumn();
        if ($seeded) return;

        $defaults = [
            [100, 1, 20],
            [150, 1, 30],
            [200, 1, 50],
            [250, 1, null],
            [500, 7, 200],
            [1000, 7, 300],
            [1500, 15, 500],
            [2000, 30, 1000],
            [3000, 30, null],
        ];

        $this->database->beginTransaction();
        try {
            foreach ($defaults as [$price, $durationDays, $quotaTenths]) {
                $offer = [
                    'price' => $price,
                    'durationDays' => $durationDays,
                    'quotaTenths' => $quotaTenths,
                    'active' => true,
                    'portal' => true,
                ];
                $statement = $this->database->prepare(
                    'INSERT OR IGNORE INTO offers
                        (id, share_id, price, duration_days, quota_tenths, active, portal, content_key)
                     VALUES
                        (:id, :share_id, :price, :duration_days, :quota_tenths, :active, :portal, :content_key)'
                );
                $statement->execute($this->parameters($offer, bin2hex(random_bytes(16)), bin2hex(random_bytes(16))));
            }
            $this->database->exec(
                "INSERT INTO offers_meta (meta_key, meta_value) VALUES ('default_offers_seeded', '1')"
            );
            $this->database->commit();
        } catch (Throwable $error) {
            $this->database->rollBack();
            throw $error;
        }
    }

    private function byId(string $id): ?array
    {
        $statement = $this->database->prepare(
            'SELECT id, share_id, price, duration_days, quota_tenths, active, portal
             FROM offers WHERE id = :id'
        );
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return $row ? $this->toOffer($row) : null;
    }

    private function toOffer(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'shareId' => (string) $row['share_id'],
            'price' => (int) $row['price'],
            'durationDays' => (int) $row['duration_days'],
            'quotaGb' => $row['quota_tenths'] === null
                ? null
                : (int) $row['quota_tenths'] / 10,
            'active' => (bool) $row['active'],
            'portal' => (bool) $row['portal'],
        ];
    }

    private function contentKey(array $offer): string
    {
        return implode('|', [
            $offer['price'],
            $offer['durationDays'],
            $offer['quotaTenths'] === null ? 'illimite' : $offer['quotaTenths'],
        ]);
    }

    private function parameters(array $offer, string $id, ?string $shareId): array
    {
        $parameters = [
            'id' => $id,
            'price' => $offer['price'],
            'duration_days' => $offer['durationDays'],
            'quota_tenths' => $offer['quotaTenths'],
            'active' => $offer['active'] ? 1 : 0,
            'portal' => $offer['portal'] ? 1 : 0,
            'content_key' => $this->contentKey($offer),
        ];
        if ($shareId !== null) $parameters['share_id'] = $shareId;
        return $parameters;
    }
}
