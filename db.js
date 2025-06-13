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
                console.error('Erreur lors de la création de la table:', err);
            } else {
                // Vérifier si la table est vide
                db.get('SELECT COUNT(*) as count FROM counter', (err, row) => {
                    if (err) {
                        console.error('Erreur lors de la vérification de la table:', err);
                    } else if (row.count === 0) {
                        // Insérer l'enregistrement initial si la table est vide
                        db.run('INSERT INTO counter (counter, date) VALUES (0, CURRENT_TIMESTAMP)');
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