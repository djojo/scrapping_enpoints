const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Créer une connexion à la base de données SQLite
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Erreur lors de la connexion à la base de données:', err);
    } else {
        console.log('✅ Connexion à la base de données SQLite établie');
        
        // Créer la table counter si elle n'existe pas
        db.run(`
            CREATE TABLE IF NOT EXISTS counter (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                counter INTEGER NOT NULL DEFAULT 0,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table counter:', err);
            } else {
                // Vérifier si la table est vide
                db.get('SELECT COUNT(*) as count FROM counter', (err, row) => {
                    if (err) {
                        console.error('Erreur lors de la vérification de la table counter:', err);
                    } else if (row.count === 0) {
                        // Insérer l'enregistrement initial si la table est vide
                        db.run('INSERT INTO counter (counter, date) VALUES (0, CURRENT_TIMESTAMP)');
                    }
                });
            }
        });

        // Créer la table proxy pour les informations d'authentification Webshare
        db.run(`
            CREATE TABLE IF NOT EXISTS proxy (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table proxy:', err);
            } else {
                console.log('✅ Table proxy créée ou vérifiée');
            }
        });

        // Créer la table credentials si elle n'existe pas
        db.run(`
            CREATE TABLE IF NOT EXISTS credentials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                ip TEXT DEFAULT NULL,
                port INTEGER DEFAULT NULL,
                status TEXT NOT NULL DEFAULT 'working' CHECK(status IN ('working', 'striked')),
                proxy_status TEXT DEFAULT 'unknown' CHECK(proxy_status IN ('working', 'failed', 'unknown')),
                countused INTEGER NOT NULL DEFAULT 0,
                lastdateused TIMESTAMP DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table credentials:', err);
            } else {
                console.log('✅ Table credentials créée ou vérifiée');
                
                // Vérifier si les colonnes ip, port et proxy_status existent déjà
                db.all("PRAGMA table_info(credentials)", (err, columns) => {
                    if (err) {
                        console.error('Erreur lors de la vérification des colonnes:', err);
                        return;
                    }
                    
                    const hasIp = columns.some(col => col.name === 'ip');
                    const hasPort = columns.some(col => col.name === 'port');
                    const hasProxyStatus = columns.some(col => col.name === 'proxy_status');
                    
                    if (!hasIp) {
                        db.run("ALTER TABLE credentials ADD COLUMN ip TEXT DEFAULT NULL", (err) => {
                            if (err) {
                                console.error('Erreur lors de l\'ajout de la colonne ip:', err);
                            } else {
                                console.log('✅ Colonne ip ajoutée à la table credentials');
                            }
                        });
                    }
                    
                    if (!hasPort) {
                        db.run("ALTER TABLE credentials ADD COLUMN port INTEGER DEFAULT NULL", (err) => {
                            if (err) {
                                console.error('Erreur lors de l\'ajout de la colonne port:', err);
                            } else {
                                console.log('✅ Colonne port ajoutée à la table credentials');
                            }
                        });
                    }
                    
                    if (!hasProxyStatus) {
                        db.run("ALTER TABLE credentials ADD COLUMN proxy_status TEXT DEFAULT 'unknown' CHECK(proxy_status IN ('working', 'failed', 'unknown'))", (err) => {
                            if (err) {
                                console.error('Erreur lors de l\'ajout de la colonne proxy_status:', err);
                            } else {
                                console.log('✅ Colonne proxy_status ajoutée à la table credentials');
                            }
                        });
                    }
                });
            }
        });
    }
});

// Fonction pour exécuter une requête avec promesse
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Fonction pour exécuter une requête qui modifie la base de données
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

module.exports = {
    query,
    run
}; 