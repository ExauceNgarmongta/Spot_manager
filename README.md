# Spot_manager

## Administration MikroTik

La page réseau est disponible à `http://127.0.0.1:8080/html/admin.html` quand le serveur PHP intégré est lancé depuis la racine du projet. Les opérations RouterOS passent par `api.php`; le navigateur ne reçoit jamais les identifiants du routeur.

1. Créer la configuration locale : `cp config.example.php config.local.php`.
2. Dans `config.local.php`, définir un jeton administrateur aléatoire, puis le nom, l’adresse et les identifiants API du routeur. Pour le CHR local, l’adresse peut être `127.0.0.1:8443`.
3. Vérifier que l’extension cURL est chargée dans le PHP utilisé par le serveur : `php -m | grep -i curl`.
4. Démarrer l’application : `php -S 127.0.0.1:8080 -t .`.
5. Ouvrir la page Réseau, cliquer sur **Connecter le routeur** et saisir le jeton administrateur.

Ne pas versionner `config.local.php` ni réutiliser en production le mot de passe communiqué dans une capture ou un échange. Activez HTTPS et un contrôle d’accès administrateur avant toute exposition hors de la machine locale. La page démo reste disponible sans cette configuration.

## Gestion des offres

La page Offres enregistre les forfaits dans une base SQLite locale. Le fichier est créé automatiquement dans `../spotmanager-data/offers.sqlite`, hors du dossier servi par PHP. Un chemin personnalisé peut être défini avec `offers_db_path` dans `config.local.php`. Les offres de démonstration sont insérées une seule fois à la première ouverture de la base.

La gestion des offres nécessite le jeton `admin_token` de `config.local.php`. Les liens de partage utilisent un identifiant aléatoire enregistré en base et ouvrent `html/offre.html`; seules les offres actives sont accessibles par ce lien. Les doublons de prix, durée et volume sont refusés par une contrainte unique SQLite, y compris lorsque plusieurs requêtes arrivent simultanément.