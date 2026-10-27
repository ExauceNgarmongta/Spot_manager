<?php
/**
 * MikrotikClient — client PHP pour l'API REST de RouterOS v7.
 * Un objet = un routeur (joint via son IP de tunnel WireGuard).
 * Prérequis PHP : extension curl.
 */
class MikrotikClient
{
    public function __construct(
        private string $host,
        private string $user,
        private string $password,
        private bool $verifyTls = false,
        private int $timeout = 8
    ) {}

    /** Requête générique vers /rest/... */
    private function request(string $method, string $path, ?array $body = null): array
    {
        $ch = curl_init("https://{$this->host}/rest/" . ltrim($path, '/'));
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD        => "{$this->user}:{$this->password}",
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_SSL_VERIFYPEER => $this->verifyTls,
            CURLOPT_SSL_VERIFYHOST => $this->verifyTls ? 2 : 0,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        $raw  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            throw new RuntimeException("MikroTik injoignable : $err");
        }
        $data = json_decode($raw, true) ?? [];
        if ($code >= 400) {
            $msg = $data['detail'] ?? $data['message'] ?? $raw;
            throw new RuntimeException("Erreur MikroTik ($code) : $msg");
        }
        return $data;
    }

    /** Test de santé : retourne les infos système ou lève une exception. */
    public function health(): array
    {
        return $this->request('GET', 'system/resource');
    }

    /** Crée l'accès hotspot après paiement validé. */
    public function createUser(
        string $username,
        string $password,
        string $profile,
        ?string $limitUptime = null,
        ?string $limitBytes = null,
        ?string $comment = null
    ): array {
        $body = ['name' => $username, 'password' => $password, 'profile' => $profile];
        if ($limitUptime) $body['limit-uptime'] = $limitUptime;
        if ($limitBytes)  $body['limit-bytes-total'] = (string) $this->toBytes($limitBytes);
        if ($comment)     $body['comment'] = $comment;
        return $this->request('PUT', 'ip/hotspot/user', $body);
    }

    /** Sessions actives (pull de la consommation en temps réel). */
    public function activeSessions(): array
    {
        return $this->request('GET', 'ip/hotspot/active');
    }

    /** Tous les comptes hotspot, y compris ceux qui ne sont pas connectés. */
    public function users(): array
    {
        return $this->request('GET', 'ip/hotspot/user');
    }

    /** Détail d'un utilisateur (bytes-in/out, uptime cumulés). */
    public function getUser(string $username): ?array
    {
        $res = $this->request('GET', 'ip/hotspot/user?name=' . urlencode($username));
        return $res[0] ?? null;
    }

    /** Déconnecte un utilisateur actif (ordre envoyé par SpotManager). */
    public function disconnect(string $username): bool
    {
        $res = $this->request('GET', 'ip/hotspot/active?user=' . urlencode($username));
        foreach ($res as $session) {
            $this->request('DELETE', 'ip/hotspot/active/' . $session['.id']);
        }
        return !empty($res);
    }

    /** Désactive/supprime l'utilisateur pour empêcher toute reconnexion. */
    public function removeUser(string $username): void
    {
        $user = $this->getUser($username);
        if ($user) {
            $this->request('DELETE', 'ip/hotspot/user/' . $user['.id']);
        }
    }

    /** Conso en pourcentage du quota volume (pour l'alerte à 95 %). */
    public function usagePercent(string $username): ?float
    {
        $u = $this->getUser($username);
        if (!$u || empty($u['limit-bytes-total'])) return null;
        $used  = (int)($u['bytes-in'] ?? 0) + (int)($u['bytes-out'] ?? 0);
        return round($used / (int)$u['limit-bytes-total'] * 100, 1);
    }

    private function toBytes(string $v): int
    {
        $v = strtoupper(trim($v));
        $mult = ['K' => 1024, 'M' => 1024 ** 2, 'G' => 1024 ** 3];
        $unit = substr($v, -1);
        return isset($mult[$unit]) ? (int)substr($v, 0, -1) * $mult[$unit] : (int)$v;
    }
}