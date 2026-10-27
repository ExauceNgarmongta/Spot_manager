<?php
return [
    // Copier ce fichier vers config.local.php puis remplacer les valeurs.
    'admin_token' => 'REMPLACER_PAR_UN_JETON_ALEATOIRE_LONG',
    // La base est créée hors du dossier servi par le serveur PHP.
    'offers_db_path' => dirname(__DIR__) . '/spotmanager-data/offers.sqlite',
    'router' => [
        'name' => 'CHR local',
        'host' => '127.0.0.1:8443',
        'user' => 'spotmanager',
        'password' => 'admin',
        'verify_tls' => false,
    ],
];