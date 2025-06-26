const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const session = require('express-session');
const db = require('./db');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour parser JSON et form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration des sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'selleramp-roi-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // true en production avec HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 heures
    }
}));

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static('public'));

// Middleware d'authentification
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        return res.redirect('/login');
    }
};

// Routes publiques (pas d'authentification requise)
const publicRoutes = ['/login'];

// Middleware global pour vérifier l'authentification
app.use((req, res, next) => {
    // Permettre l'accès aux routes publiques, aux assets et aux API
    if (publicRoutes.includes(req.path) || 
        req.path.startsWith('/css') || 
        req.path.startsWith('/js') || 
        req.path.startsWith('/images') ||
        req.path.startsWith('/api/')) {
        return next();
    }
    
    // Vérifier l'authentification pour les pages web uniquement
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        return res.redirect('/login');
    }
});

// Fonction pour simuler un délai humain
function delaiHumain(min = 500, max = 2000) {
  const delai = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delai));
}

// Fonction pour nettoyer les fichiers temporaires Puppeteer
function cleanupPuppeteerTempFiles() {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    
    files.forEach(file => {
      if (file.startsWith('puppeteer_dev_chrome_profile-')) {
        const fullPath = path.join(tmpDir, file);
        try {
          // Supprimer récursivement le dossier
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`🧹 Nettoyé: ${file}`);
        } catch (error) {
          // Ignorer les erreurs de suppression (fichiers en cours d'utilisation)
          console.log(`⚠️  Impossible de nettoyer: ${file} (probablement en cours d'utilisation)`);
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors du nettoyage des fichiers temporaires:', error.message);
  }
}

// Fonction pour taper comme un humain
async function taperHumain(page, selector, texte) {
  await page.focus(selector);
  await delaiHumain(200, 500);
  
  for (let char of texte) {
    await page.keyboard.type(char);
    await delaiHumain(50, 200); // Délai entre chaque caractère
  }
}


// Fonction pour calculer le ROI via SellerAmp
async function calculerROI(code, prix, email, password, proxyIp = null, proxyPort = null) {
  console.log(`Calcul du ROI pour le code: ${code} avec le prix: ${prix}`);
  if (proxyIp && proxyPort) {
    console.log(`🌐 Utilisation du proxy: ${proxyIp}:${proxyPort}`);
  }
  
  // Configuration adaptative selon l'environnement
  const isLinux = process.platform === 'linux';
  const isMac = process.platform === 'darwin';
  
  let browserConfig = {
    headless: "new",
    defaultViewport: { width: 1366, height: 768 },
    userDataDir: null, // Forcer l'utilisation d'un répertoire temporaire qui sera nettoyé
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--window-size=1366,768',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--temp-profile', // Utiliser un profil temporaire
      '--incognito' // Mode incognito pour éviter la persistance
    ]
  };

  // Ajouter la configuration proxy si fournie
  if (proxyIp && proxyPort) {
    browserConfig.args.push(`--proxy-server=http://${proxyIp}:${proxyPort}`);
  }

  // Configuration spécifique à Linux (serveur)
  if (isLinux) {
    browserConfig.executablePath = process.env.CHROME_PATH || '/usr/bin/chromium-browser';
    browserConfig.args.push('--single-process', '--no-zygote');
  }

  // Configuration spécifique à macOS (local)
  if (isMac) {
    // Utiliser Chrome par défaut de Puppeteer sur macOS
    // Pas besoin d'executablePath, Puppeteer gérera automatiquement
  }

  console.log(`🖥️  Plateforme détectée: ${process.platform}`);
  if (browserConfig.executablePath) {
    console.log(`🌐 Utilisation de: ${browserConfig.executablePath}`);
  } else {
    console.log(`🌐 Utilisation du navigateur par défaut de Puppeteer`);
  }

  const browser = await puppeteer.launch(browserConfig);
  
  try {
    const page = await browser.newPage();
    
    // Authentification proxy si nécessaire
    if (proxyIp && proxyPort) {
      // Récupérer les informations d'authentification proxy
      const proxyAuth = await getProxyAuth();
      if (proxyAuth) {
        await page.authenticate({
          username: proxyAuth.username,
          password: proxyAuth.password
        });
        console.log(`🔐 Authentification proxy configurée`);
      }
    }
    
    // Définir un User-Agent réaliste
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Aller sur la page de connexion
    console.log('📍 Étape 1: Navigation vers la page de connexion...');
    await page.goto('https://sas.selleramp.com/site/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    
    // Délai humain après le chargement
    await delaiHumain(1000, 3000);
    
    // Attendre que les champs de connexion soient disponibles
    console.log('📍 Étape 2: Attente des champs de connexion...');
    await page.waitForSelector('#loginform-email', { timeout: 10000 });
    
    // Simuler un mouvement de souris vers le champ email
    await page.hover('#loginform-email');
    await delaiHumain(300, 800);
    
    // Se connecter avec frappe humaine
    console.log('📍 Étape 3: Saisie des credentials...');
    await taperHumain(page, '#loginform-email', email);
    await delaiHumain(500, 1500);
    
    await page.hover('#loginform-password');
    await delaiHumain(200, 600);
    await taperHumain(page, '#loginform-password', password);
    
    // Pause avant de cliquer sur le bouton de connexion
    await delaiHumain(800, 2000);
    
    // Cliquer sur le bouton de connexion
    console.log('📍 Étape 4: Clic sur le bouton de connexion...');
    await page.hover('button[name="login-button"]');
    await delaiHumain(200, 500);
    await page.click('button[name="login-button"]');
    
    // Attendre la redirection après connexion
    console.log('📍 Étape 5: Attente de la redirection...');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Délai humain après redirection
    await delaiHumain(1500, 3000);
    
    // Attendre que le champ de recherche soit disponible
    console.log('📍 Étape 6: Attente du champ de recherche...');
    await page.waitForSelector('#saslookup-search_term', { timeout: 10000 });
    
    // Simuler un scroll ou mouvement
    await page.evaluate(() => window.scrollTo(0, 200));
    await delaiHumain(500, 1000);
    
    // Entrer le code dans le champ de recherche avec frappe humaine
    console.log('📍 Étape 7: Saisie du code produit...');
    await page.hover('#saslookup-search_term');
    await delaiHumain(300, 800);
    await page.evaluate(() => document.querySelector('#saslookup-search_term').value = '');
    await taperHumain(page, '#saslookup-search_term', code);
    
    // Pause avant d'appuyer sur Entrée
    await delaiHumain(800, 1500);
    
    // Appuyer sur Entrée pour lancer la recherche
    console.log('📍 Étape 8: Appui sur Entrée pour lancer la recherche...');
    await page.keyboard.press('Enter');
    
    // Délai pour laisser la recherche se charger
    await delaiHumain(2000, 4000);
    
    // Vérifier s'il y a des résultats à choisir et cliquer sur le premier
    console.log('📍 Étape 8.5: Vérification des résultats de recherche...');
    try {
      await page.waitForSelector('.sas-choose-title', { timeout: 5000 });
      console.log('📍 Résultats trouvés, clic sur le premier élément...');
      await page.hover('.sas-choose-title');
      await delaiHumain(300, 700);
      await page.click('.sas-choose-title');
      await delaiHumain(1000, 2000);
    } catch (error) {
      console.log('📍 Aucun résultat à choisir, continuation directe...');
    }
    
    // Attendre que les résultats se chargent et que le champ prix soit disponible
    console.log('📍 Étape 9: Attente du champ prix...');
    let prixSelector = null;
    try {
      await page.waitForSelector('input#qi_cost.roi_to_sp.money-input', { timeout: 5000 });
      prixSelector = 'input#qi_cost.roi_to_sp.money-input';
      console.log('📍 Champ prix trouvé avec sélecteur complet');
    } catch (error) {
      try {
        await page.waitForSelector('#qi_cost', { timeout: 10000 });
        prixSelector = '#qi_cost';
        console.log('📍 Champ prix trouvé avec sélecteur simple');
      } catch (error2) {
        // Si aucun champ prix n'est trouvé, retourner une erreur explicite
        return {
          success: false,
          error: "Champ prix (#qi_cost) introuvable sur la page."
        };
      }
    }
    
    // Simuler un mouvement vers le champ prix
    await page.hover(prixSelector);
    await delaiHumain(500, 1000);
    
    // Entrer le prix avec une approche plus robuste pour les champs money-input
    console.log('📍 Étape 10: Saisie du prix...');
    
    // Calculer le prix TTC (TVA 20%)
    const prixTTC = (parseFloat(prix) * 1.20).toFixed(2);
    console.log(`Prix HT: ${prix}€, Prix TTC: ${prixTTC}€`);
    
    // Cliquer sur le champ pour le focus
    await page.click(prixSelector);
    await delaiHumain(200, 400);
    
    // Sélectionner tout le contenu existant et le remplacer
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await delaiHumain(100, 200);
    
    // Taper le nouveau prix caractère par caractère
    for (let char of prixTTC.toString()) {
      await page.keyboard.type(char);
      await delaiHumain(100, 300);
    }
    
    // Alternative : déclencher les événements input/change pour les champs avec validation
    await page.evaluate((selector, value) => {
      const input = document.querySelector(selector);
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, prixSelector, prixTTC.toString());
    
    // Pause avant d'appuyer sur Entrée
    await delaiHumain(1000, 2000);
    
    // Appuyer sur Entrée
    console.log('📍 Étape 11: Appui sur Entrée...');
    await page.keyboard.press('Enter');
    
    // Délai pour laisser le calcul se faire
    await delaiHumain(2000, 4000);
    
    // Attendre que le ROI soit calculé
    console.log('📍 Étape 12: Attente du calcul ROI...');
    await page.waitForSelector('#saslookup-roi', { timeout: 10000 });
    
    // Petit délai avant de récupérer la valeur
    await delaiHumain(500, 1000);
    
    // Récupérer la valeur du ROI
    console.log('📍 Étape 13: Récupération du ROI...');
    const roi = await page.$eval('#saslookup-roi', element => element.textContent.trim());
    
    // Récupérer les ventes estimées par mois
    console.log('📍 Étape 14: Récupération des ventes estimées...');
    let estimatedSales = 'N/A';
    try {
      estimatedSales = await page.$eval('.estimated_sales_per_mo', element => {
        return element.textContent.replace(/[^\d+]/g, '').trim();
      });
    } catch (error) {
      console.log('⚠️ Impossible de récupérer les ventes estimées:', error.message);
    }
    
    console.log(`ROI calculé: ${roi}`);
    console.log(`Ventes estimées: ${estimatedSales}`);
    
    return {
      success: true,
      code,
      prix,
      roi,
      estimatedSales
    };
    
  } catch (error) {
    console.error('❌ Erreur lors du calcul du ROI:', error);
    console.error('Stack trace:', error.stack);
    return {
      success: false,
      error: 'Erreur lors du calcul du ROI'
    };
  } finally {
    await browser.close();
  }
}

// Fonction pour récupérer les credentials avec l'utilisation la plus ancienne
async function getOldestCredentials() {
  try {
    const result = await db.query(`
      SELECT * FROM credentials 
      WHERE status = 'working' 
      ORDER BY lastdateused ASC, id ASC 
      LIMIT 1
    `);
    return result[0] || null;
  } catch (error) {
    console.error('Erreur lors de la récupération des credentials:', error);
    return null;
  }
}

// Fonction pour récupérer les informations d'authentification proxy
async function getProxyAuth() {
  try {
    const result = await db.query(`
      SELECT * FROM proxy 
      ORDER BY id DESC 
      LIMIT 1
    `);
    return result[0] || null;
  } catch (error) {
    console.error('Erreur lors de la récupération des informations proxy:', error);
    return null;
  }
}

// Fonction pour mettre à jour l'utilisation d'un credential
async function updateCredentialUsage(id) {
  try {
    await db.run(`
      UPDATE credentials 
      SET countused = countused + 1, lastdateused = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [id]);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du credential:', error);
  }
}

// Endpoint de test
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API SellerAmp ROI fonctionne correctement',
    timestamp: new Date().toISOString()
  });
});

// Route pour afficher les credentials
app.get('/credentials', async (req, res) => {
    try {
        const credentials = await db.query('SELECT id, login, ip, port, status, proxy_status, countused, lastdateused, created_at FROM credentials ORDER BY id DESC');
        res.render('credentials', { credentials });
    } catch (error) {
        console.error('Erreur lors de la récupération des credentials:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Route pour afficher les proxies
app.get('/proxy', async (req, res) => {
    try {
        const proxies = await db.query('SELECT * FROM proxy ORDER BY created_at DESC');
        res.render('proxy', { proxies });
    } catch (error) {
        console.error('Erreur lors de la récupération des proxies:', error);
        res.status(500).send('Erreur serveur');
    }
});

// API CRUD pour les credentials
// Créer un credential
app.post('/api/credentials', async (req, res) => {
    try {
        const { login, password, ip, port, status = 'working' } = req.body;
        
        if (!login || !password) {
            return res.status(400).json({
                success: false,
                error: 'Login et password sont requis'
            });
        }
        
        await db.run(`
            INSERT INTO credentials (login, password, ip, port, status) 
            VALUES (?, ?, ?, ?, ?)
        `, [login, password, ip || null, port || null, status]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la création du credential:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({
                success: false,
                error: 'Ce login existe déjà'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erreur serveur'
            });
        }
    }
});

// Lire tous les credentials
app.get('/api/credentials', async (req, res) => {
    try {
        const credentials = await db.query('SELECT id, login, ip, port, status, proxy_status, countused, lastdateused, created_at FROM credentials ORDER BY id DESC');
        res.json({ success: true, credentials });
    } catch (error) {
        console.error('Erreur lors de la récupération des credentials:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// Mettre à jour un credential
app.put('/api/credentials/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { login, password, ip, port, status } = req.body;
        
        if (!login) {
            return res.status(400).json({
                success: false,
                error: 'Login est requis'
            });
        }
        
        let sql = 'UPDATE credentials SET login = ?, ip = ?, port = ?, status = ? WHERE id = ?';
        let params = [login, ip || null, port || null, status, id];
        
        if (password) {
            sql = 'UPDATE credentials SET login = ?, password = ?, ip = ?, port = ?, status = ? WHERE id = ?';
            params = [login, password, ip || null, port || null, status, id];
        }
        
        await db.run(sql, params);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du credential:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            res.status(400).json({
                success: false,
                error: 'Ce login existe déjà'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Erreur serveur'
            });
        }
    }
});

// Supprimer un credential
app.delete('/api/credentials/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.run('DELETE FROM credentials WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la suppression du credential:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// API CRUD pour les proxies
// Créer un proxy
app.post('/api/proxy', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username et password sont requis'
            });
        }
        
        await db.run(`
            INSERT INTO proxy (username, password) 
            VALUES (?, ?)
        `, [username, password]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la création du proxy:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// Lire tous les proxies
app.get('/api/proxy', async (req, res) => {
    try {
        const proxies = await db.query('SELECT id, username, created_at FROM proxy ORDER BY id DESC');
        res.json({ success: true, proxies });
    } catch (error) {
        console.error('Erreur lors de la récupération des proxies:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// Mettre à jour un proxy
app.put('/api/proxy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password } = req.body;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Username est requis'
            });
        }
        
        let sql = 'UPDATE proxy SET username = ? WHERE id = ?';
        let params = [username, id];
        
        if (password) {
            sql = 'UPDATE proxy SET username = ?, password = ? WHERE id = ?';
            params = [username, password, id];
        }
        
        await db.run(sql, params);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du proxy:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// Supprimer un proxy
app.delete('/api/proxy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.run('DELETE FROM proxy WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Erreur lors de la suppression du proxy:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// Route pour tester un proxy
app.post('/api/testproxy', async (req, res) => {
    try {
        const { credentialId } = req.body;
        
        if (!credentialId) {
            return res.status(400).json({ success: false, error: 'ID du credential requis' });
        }

        // Récupérer le credential avec IP et port
        const credentialResult = await db.query('SELECT * FROM credentials WHERE id = ?', [credentialId]);
        const credential = credentialResult[0];

        if (!credential) {
            return res.status(404).json({ success: false, error: 'Credential non trouvé' });
        }

        if (!credential.ip || !credential.port) {
            return res.status(400).json({ success: false, error: 'IP et port requis pour tester le proxy' });
        }

        // Récupérer les informations d'authentification proxy
        const proxyAuth = await getProxyAuth();
        if (!proxyAuth) {
            return res.status(400).json({ success: false, error: 'Informations d\'authentification proxy non configurées' });
        }

        console.log(`🌐 Test du proxy: ${credential.ip}:${credential.port}`);

        const startTime = Date.now();

        // Tester la connexion proxy avec Puppeteer
        const browser = await puppeteer.launch({ 
            headless: true,
            userDataDir: null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--temp-profile',
                '--incognito',
                `--proxy-server=http://${credential.ip}:${credential.port}`
            ]
        });
        
        const page = await browser.newPage();
        
        // Authentification proxy
        await page.authenticate({
            username: proxyAuth.username,
            password: proxyAuth.password
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        try {
            // Tester la connexion en allant sur un service de détection d'IP
            await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle2', timeout: 30000 });
            
            const responseTime = Date.now() - startTime;
            
            // Récupérer l'IP détectée
            const ipInfo = await page.evaluate(() => {
                try {
                    const bodyText = document.body.textContent;
                    const parsed = JSON.parse(bodyText);
                    return parsed.origin;
                } catch (e) {
                    return document.body.textContent.trim();
                }
            });
            
            await browser.close();
            
            // Mettre à jour le statut du proxy à 'working'
            await db.run('UPDATE credentials SET proxy_status = ? WHERE id = ?', ['working', credentialId]);
            
            res.json({
                success: true,
                detectedIp: ipInfo,
                responseTime: responseTime,
                proxyIp: credential.ip,
                proxyPort: credential.port
            });

        } catch (error) {
            await browser.close();
            console.error('Erreur lors du test proxy:', error);
            
            // Mettre à jour le statut du proxy à 'failed'
            await db.run('UPDATE credentials SET proxy_status = ? WHERE id = ?', ['failed', credentialId]);
            
            res.status(500).json({
                success: false,
                error: `Connexion proxy échouée: ${error.message}`
            });
        }

    } catch (error) {
        console.error('Erreur lors du test du proxy:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Route pour tester un credential
app.post('/api/testcredentials', async (req, res) => {
    try {
        const { credentialId } = req.body;
        
        if (!credentialId) {
            return res.status(400).json({ success: false, error: 'ID du credential requis' });
        }

        // Récupérer le credential
        const credentialResult = await db.query('SELECT * FROM credentials WHERE id = ?', [credentialId]);
        const credential = credentialResult[0];

        if (!credential) {
            return res.status(404).json({ success: false, error: 'Credential non trouvé' });
        }

        console.log(`🧪 Test du credential: ${credential.login}`);

        // Tester la connexion avec Puppeteer
        const browser = await puppeteer.launch({ 
            headless: true,
            userDataDir: null, // Forcer l'utilisation d'un répertoire temporaire qui sera nettoyé
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--temp-profile',
                '--incognito'
            ]
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        let newStatus = 'working';
        let testResult = 'Test réussi';

        try {
            // Aller sur la page de connexion SellerAmp
            await page.goto('https://sas.selleramp.com/site/login', { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Remplir les champs de connexion
            await page.waitForSelector('input[name="LoginForm[email]"]', { timeout: 10000 });
            await page.type('input[name="LoginForm[email]"]', credential.login);
            await page.type('input[name="LoginForm[password]"]', credential.password);
            
            // Cliquer sur le bouton de connexion
            await page.click('button[name="login-button"]');
            
            // Attendre la redirection ou un message d'erreur
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Vérifier s'il y a un message d'erreur
            const errorMessage = await page.evaluate(() => {
                const errorElement = document.querySelector('.alert-danger, .alert-error, .error, [class*="error"], .help-block');
                return errorElement ? errorElement.textContent.trim() : null;
            });
            
            // Vérifier le contenu de la page pour détecter les problèmes de compte
            const pageContent = await page.content();
            
            if (errorMessage && errorMessage.includes('Problem With Your Account')) {
                newStatus = 'striked';
                testResult = 'Compte bloqué détecté';
            } else if (pageContent.includes('Problem With Your Account')) {
                newStatus = 'striked';
                testResult = 'Compte bloqué détecté';
            } else if (errorMessage) {
                newStatus = 'striked';
                testResult = `Erreur de connexion: ${errorMessage}`;
            } else {
                // Vérifier si on est bien connecté (présence d'éléments du dashboard ou changement d'URL)
                const currentUrl = page.url();
                const isLoggedIn = await page.evaluate(() => {
                    // Vérifier la présence d'éléments typiques d'une session connectée
                    return document.querySelector('.dashboard, .user-menu, [class*="dashboard"], .navbar-nav, .dropdown-toggle') !== null ||
                           document.title.toLowerCase().includes('dashboard') ||
                           document.body.innerHTML.includes('logout') ||
                           document.body.innerHTML.includes('déconnexion');
                });
                
                const urlChanged = !currentUrl.includes('/site/login');
                
                if (!isLoggedIn && !urlChanged) {
                    newStatus = 'striked';
                    testResult = 'Connexion échouée - Toujours sur la page de login';
                } else if (urlChanged || isLoggedIn) {
                    newStatus = 'working';
                    testResult = 'Connexion réussie';
                }
            }
            
        } catch (error) {
            console.error('Erreur lors du test:', error);
            newStatus = 'striked';
            testResult = `Erreur technique: ${error.message}`;
        }
        
        await browser.close();

        // Mettre à jour le status dans la base de données
        await db.run('UPDATE credentials SET status = ? WHERE id = ?', [newStatus, credentialId]);

        console.log(`✅ Test terminé pour ${credential.login}: ${newStatus}`);

        res.json({ 
            success: true, 
            newStatus: newStatus,
            message: testResult,
            credentialId: credentialId
        });

    } catch (error) {
        console.error('Erreur lors du test du credential:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint pour calculer le ROI (modifié pour utiliser les credentials de la base)
app.post('/api/roi', async (req, res) => {
  try {
    const { code, prix } = req.body;
    if (!code || !prix) {
      return res.status(400).json({
        success: false,
        error: 'Le code et le prix sont requis'
      });
    }
    
    // Récupérer les credentials avec l'utilisation la plus ancienne
    const credentials = await getOldestCredentials();
    if (!credentials) {
      return res.status(400).json({
        success: false,
        error: 'Aucun credential disponible'
      });
    }
    
    // Calculer le ROI avec les credentials récupérés et les informations proxy
    const result = await calculerROI(
      code, 
      prix, 
      credentials.login, 
      credentials.password,
      credentials.ip,
      credentials.port
    );
    
    if (result.success) {
      // Mettre à jour l'utilisation du credential
      await updateCredentialUsage(credentials.id);
    }
    
    if (result.success === false) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Erreur lors du calcul du ROI:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du calcul du ROI'
    });
  }
});

// Route de démonstration pour montrer les calculs de frais FBA/Port
app.get('/api/keepa-roi/demo', (req, res) => {
  // Simulation d'un produit avec des données complètes pour démonstration
  const produitDemo = {
    asin: "B07DEMO123",
    title: "Parfum Exemple - Démonstration des frais FBA",
    brand: "Demo Brand",
    packageDimensions: {
      length: 15,
      width: 10, 
      height: 12
    },
    packageWeight: 250, // 250 grammes
    referralFeePercent: 15
  };
  
  const prixVenteDemo = 48.99;  // Prix de vente pour avoir un exemple rentable (> 15%)
  const prixAchatDemo = 25.00;
  const prixTTCDemo = prixAchatDemo * 1.20; // 30.60€
  
  // Calcul des frais avec la nouvelle fonction
  const fraisData = calculerFraisFBAEtPort(produitDemo, prixVenteDemo);
  
  // Calcul du ROI selon la nouvelle méthode (HT/TTC séparés)
  const prixVenteTTC = prixVenteDemo;
  const prixVenteHT = prixVenteTTC / 1.2;
  
  // Frais Amazon calculés sur le TTC puis convertis en HT
  const fraisAmazonTTC = prixVenteTTC * (produitDemo.referralFeePercent / 100);
  const fraisAmazonHT = fraisAmazonTTC / 1.2;
  
  // Frais FBA et port en TTC, conversion en HT
  const fraisFBATTC = fraisData.fraisFBA;
  const fraisFBAHT = fraisFBATTC / 1.2;
  const fraisPortTTC = fraisData.fraisPort;
  const fraisPortHT = fraisPortTTC / 1.2;
  
  // Calcul du bénéfice net HT
  const beneficeNetHT = prixVenteHT - prixAchatDemo - fraisAmazonHT - fraisFBAHT - fraisPortHT;
  const roiPourcentageHT = (beneficeNetHT / prixAchatDemo) * 100;
  
  const demoResponse = {
    success: true,
    message: "🧪 Données de démonstration - Calcul des frais FBA et de port",
    ean: "DEMO-EAN-123456789",
    prixHT: prixAchatDemo,
    prixTTC: prixTTCDemo,
    product: {
      asin: produitDemo.asin,
      title: produitDemo.title,
      brand: produitDemo.brand,
      referralFeePercent: produitDemo.referralFeePercent,
      domain: "France (amazon.fr) - DEMO",
      domainCode: "4"
    },
    prix: {
      actuel: prixVenteDemo,
      moyen30j: 33.50,
      moyen90j: 34.20,
      moyen180j: 36.10
    },
    ventes: {
      mensuellesEstimees: 45,
      rankDrops30j: 45,
      rankDrops90j: 120,
      rankDrops180j: 230,
      rankDrops365j: 580
    },
    roi: {
      // Prix en TTC
      prixVenteTTC: prixVenteTTC,
      prixAchatTTC: prixTTCDemo,
      
      // Prix en HT
      prixVenteHT: prixVenteHT,
      prixAchatHT: prixAchatDemo,
      
      // Frais en TTC
      fraisTTC: {
        amazon: fraisAmazonTTC,
        fba: fraisFBATTC,
        port: fraisPortTTC,
        total: fraisAmazonTTC + fraisFBATTC + fraisPortTTC
      },
      
      // Frais en HT
      fraisHT: {
        amazon: fraisAmazonHT,
        fba: fraisFBAHT,
        port: fraisPortHT,
        total: fraisAmazonHT + fraisFBAHT + fraisPortHT
      },
      
      fraisDetails: fraisData.details,
      beneficeNetHT: beneficeNetHT,
      roiPourcentageHT: roiPourcentageHT,
      rentable: roiPourcentageHT > 15,
      
      // Détail du calcul pour transparence
      calculDetail: {
        prixVenteHT: `${prixVenteTTC.toFixed(2)}€ TTC ÷ 1.2 = ${prixVenteHT.toFixed(2)}€ HT`,
        fraisAmazonHT: `${fraisAmazonTTC.toFixed(2)}€ TTC ÷ 1.2 = ${fraisAmazonHT.toFixed(2)}€ HT`,
        fraisFBAHT: `${fraisFBATTC.toFixed(2)}€ TTC ÷ 1.2 = ${fraisFBAHT.toFixed(2)}€ HT`,
        fraisPortHT: `${fraisPortTTC.toFixed(2)}€ TTC ÷ 1.2 = ${fraisPortHT.toFixed(2)}€ HT`,
        beneficeCalcul: `${prixVenteHT.toFixed(2)} - ${prixAchatDemo.toFixed(2)} - ${fraisAmazonHT.toFixed(2)} - ${fraisFBAHT.toFixed(2)} - ${fraisPortHT.toFixed(2)} = ${beneficeNetHT.toFixed(2)}€ HT`,
        roiCalcul: `(${beneficeNetHT.toFixed(2)} ÷ ${prixAchatDemo.toFixed(2)}) × 100 = ${roiPourcentageHT.toFixed(2)}%`
      }
    },
    variations: {
      nombreVariations: 3,
      variationCSV: "B07DEMO123,B07DEMO124,B07DEMO125",
      variations: [
        {
          asin: "B07DEMO124",
          attributes: {
            "ScentName": "Vanille",
            "Size": "50ml"
          }
        },
        {
          asin: "B07DEMO125", 
          attributes: {
            "ScentName": "Rose",
            "Size": "100ml"
          }
        }
      ],
      parentAsin: "B07DEMO123"
    },
    tokensLeft: 1190,
    timestamp: new Date().toISOString()
  };
  
  res.json(demoResponse);
});

// Nouvelle route API pour calculer le ROI via Keepa
app.post('/api/keepa-roi', async (req, res) => {
  try {
    const { ean, prixHT } = req.body;
    
    // Validation des paramètres
    if (!ean || !prixHT) {
      return res.status(400).json({
        success: false,
        error: 'Le code EAN et le prix HT sont requis'
      });
    }

    // Validation du format EAN
    if (!/^\d{8,14}$/.test(ean)) {
      return res.status(400).json({
        success: false,
        error: 'Le code EAN doit être composé de 8 à 14 chiffres'
      });
    }

    // Validation du prix
    const prix = parseFloat(prixHT);
    if (isNaN(prix) || prix <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Le prix HT doit être un nombre positif'
      });
    }

    console.log(`🔍 Nouvelle demande ROI Keepa - EAN: ${ean}, Prix HT: ${prix}€`);

    // Appel de la fonction de calcul ROI Keepa
    const result = await calculROIKEEPA(ean, prix);

    // Incrémenter le compteur si le calcul est réussi
    if (result.success) {
      try {
        await db.run(
          'UPDATE counter SET counter = counter + 1, date = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM counter ORDER BY id DESC LIMIT 1)'
        );
      } catch (counterError) {
        console.error('Erreur lors de l\'incrémentation du compteur:', counterError);
        // Ne pas faire échouer la requête pour une erreur de compteur
      }
    }

    // Retourner le résultat
    if (result.success) {
      console.log(`✅ ROI Keepa calculé avec succès pour ${ean}`);
      res.json(result);
    } else {
      console.log(`❌ Échec du calcul ROI Keepa pour ${ean}: ${result.error}`);
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Erreur lors du calcul du ROI Keepa:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors du calcul du ROI'
    });
  }
});

// Routes d'authentification
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Vérification des credentials
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Scrapping2025!';
    
    if (username === adminUsername && password === adminPassword) {
        req.session.authenticated = true;
        req.session.username = username;
        res.redirect('/');
    } else {
        res.render('login', { error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }
});

// Route de déconnexion
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur lors de la déconnexion:', err);
        }
        res.redirect('/login');
    });
});

// Route pour la page d'accueil
app.get('/', (req, res) => {
    res.render('home');
});

// Route pour la page de calcul ROI
app.get('/roi', (req, res) => {
    res.render('roi');
});

// Route pour la page de calcul ROI Keepa
app.get('/keepa-roi', (req, res) => {
    res.render('keepa-roi');
});

// Route pour afficher le compteur
app.get('/counter', async (req, res) => {
    try {
        const result = await db.query('SELECT counter, date FROM counter ORDER BY id DESC LIMIT 1');
        res.render('counter', {
            counter: result[0].counter,
            date: new Date(result[0].date).toLocaleString('fr-FR')
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du compteur:', error);
        res.status(500).send('Erreur serveur');
    }
});

// API pour récupérer la valeur du compteur (pour les stats de la page d'accueil)
app.get('/api/counter/get', async (req, res) => {
    try {
        const result = await db.query('SELECT counter, date FROM counter ORDER BY id DESC LIMIT 1');
        res.json({
            success: true,
            counter: result[0].counter,
            date: result[0].date
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du compteur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// API pour incrémenter le compteur
app.post('/api/counter/increment', async (req, res) => {
    try {
        const result = await db.run(
            'UPDATE counter SET counter = counter + 1, date = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM counter ORDER BY id DESC LIMIT 1)'
        );
        const updatedCounter = await db.query('SELECT counter, date FROM counter ORDER BY id DESC LIMIT 1');
        res.json({
            success: true,
            counter: updatedCounter[0].counter,
            date: updatedCounter[0].date
        });
    } catch (error) {
        console.error('Erreur lors de l\'incrémentation du compteur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// API pour réinitialiser le compteur
app.post('/api/counter/reset', async (req, res) => {
    try {
        const result = await db.run(
            'UPDATE counter SET counter = 0, date = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM counter ORDER BY id DESC LIMIT 1)'
        );
        const updatedCounter = await db.query('SELECT counter, date FROM counter ORDER BY id DESC LIMIT 1');
        res.json({
            success: true,
            counter: updatedCounter[0].counter,
            date: updatedCounter[0].date
        });
    } catch (error) {
        console.error('Erreur lors de la réinitialisation du compteur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// Fonction pour calculer le ROI via l'API Keepa avec recherche multi-domaines
async function calculROIKEEPA(ean, prixHT) {
  console.log(`Calcul du ROI Keepa pour l'EAN: ${ean} avec le prix HT: ${prixHT}`);
  
  try {
    // Vérifier que le token Keepa est configuré
    const tokenKeepa = process.env.TOKEN_KEEPA;
    if (!tokenKeepa) {
      throw new Error('TOKEN_KEEPA non configuré dans les variables d\'environnement');
    }

    // Convertir le prix HT en TTC (TVA 20%)
    const prixTTC = prixHT * 1.20;
    console.log(`Prix TTC calculé: ${prixTTC.toFixed(2)}€`);

    // Domaines européens à tester par ordre de préférence
    const domainsToTry = [
      { code: '4', name: 'France (amazon.fr)', priority: 1 },
      { code: '3', name: 'Allemagne (amazon.de)', priority: 2 },
      { code: '9', name: 'Espagne (amazon.es)', priority: 3 },
      { code: '8', name: 'Italie (amazon.it)', priority: 4 },
      { code: '2', name: 'Royaume-Uni (amazon.co.uk)', priority: 5 }
    ];

    let lastError = null;
    let debugInfo = [];

    // Essayer chaque domaine jusqu'à trouver le produit
    for (const domain of domainsToTry) {
      try {
        console.log(`🌍 Recherche sur ${domain.name} (domain=${domain.code}) pour EAN: ${ean}`);

        // Construction de l'URL pour l'API Keepa
        const url = new URL('https://api.keepa.com/product');
        url.searchParams.append('key', tokenKeepa);
        url.searchParams.append('domain', domain.code);
        url.searchParams.append('code', ean);
        url.searchParams.append('stats', '1');
        url.searchParams.append('rating', '0');

        console.log(`Appel API Keepa: ${url.toString()}`);

        // Appel à l'API Keepa
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'ROI Calculator/1.0'
          },
          timeout: 30000 // 30 secondes
        });

        if (!response.ok) {
          throw new Error(`Erreur API Keepa: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Debug pour voir la réponse complète de Keepa
        const debugResponse = {
          domain: domain.name,
          domainCode: domain.code,
          tokensLeft: data.tokensLeft,
          productsFound: data.products ? data.products.length : 0,
          refiner: data.refiner,
          totalResults: data.totalResults,
          requestUrl: url.toString()
        };
        
        console.log('🔍 Réponse brute Keepa:', debugResponse);
        debugInfo.push(debugResponse);
        
        // Si des produits ont été trouvés, traiter et retourner
        if (data.products && data.products.length > 0) {
          console.log(`✅ Produit trouvé sur ${domain.name} !`);
          return await processKeepaProduct(data, ean, prixHT, prixTTC, domain);
        }

        console.log(`❌ Aucun produit trouvé sur ${domain.name}, essai suivant...`);
        
      } catch (error) {
        console.log(`❌ Erreur sur ${domain.name}: ${error.message}`);
        lastError = error;
        debugInfo.push({
          domain: domain.name,
          domainCode: domain.code,
          error: error.message
        });
      }
    }

    // Aucun produit trouvé sur tous les domaines
    console.log('❌ Aucun produit trouvé sur tous les domaines testés');
    
    return {
      success: false,
      error: 'Aucun produit trouvé pour cet EAN sur tous les marketplaces Amazon testés',
      ean: ean,
      prixHT: prixHT,
      prixTTC: prixTTC,
      debug: {
        domainsTestedCount: domainsToTry.length,
        lastError: lastError?.message,
        detailedDebug: debugInfo
      }
    };

    const product = data.products[0];
    
    // Extraction des données importantes du produit
    const productData = {
      asin: product.asin,
      title: product.title || 'Titre non disponible',
      brand: product.brand || 'Marque non disponible',
      categoryTree: product.categoryTree || [],
      salesRank: product.salesRanks ? Object.values(product.salesRanks)[0] : null,
      referralFeePercent: product.referralFeePercent || product.referralFeePercentage || 15
    };

    // Extraction des données de variations
    const variationsData = {
      nombreVariations: 0,
      variationCSV: product.variationCSV || null,
      variations: product.variations || [],
      parentAsin: product.parentAsin || null
    };

    // Calculer le nombre de variations
    if (product.variations && product.variations.length > 0) {
      variationsData.nombreVariations = product.variations.length;
    } else if (product.variationCSV) {
      // Si pas de détails mais qu'il y a un CSV, compter les ASIN
      variationsData.nombreVariations = product.variationCSV.split(',').filter(asin => asin.trim()).length;
    }

    // Ajouter des informations détaillées sur les variations
    if (product.variations && product.variations.length > 0) {
      variationsData.variationsDetails = product.variations.map(variation => ({
        asin: variation.asin,
        attributes: variation.attributes ? variation.attributes.reduce((acc, attr) => {
          acc[attr.dimension] = attr.value;
          return acc;
        }, {}) : {}
      }));
    }

    // Extraction des données de prix et stock
    const stats = product.stats || {};
    const current = stats.current || [];
    
    // Récupérer le prix Amazon actuel (buyBoxPrice)
    let prixAmazonActuel = null;
    if (stats.buyBoxPrice && stats.buyBoxPrice > 0) {
      prixAmazonActuel = stats.buyBoxPrice / 100; // Convertir de centimes en euros
    } else if (current.length >= 2 && current[1] > 0) {
      prixAmazonActuel = current[1] / 100; // Prix dans le tableau current
    }

    // Calcul des moyennes de prix sur différentes périodes
    const avg30 = stats.avg30 ? stats.avg30.map(price => price > 0 ? price / 100 : null).filter(p => p !== null) : [];
    const avg90 = stats.avg90 ? stats.avg90.map(price => price > 0 ? price / 100 : null).filter(p => p !== null) : [];
    const avg180 = stats.avg180 ? stats.avg180.map(price => price > 0 ? price / 100 : null).filter(p => p !== null) : [];

    const prixMoyen30j = avg30.length > 0 ? avg30.reduce((a, b) => a + b, 0) / avg30.length : null;
    const prixMoyen90j = avg90.length > 0 ? avg90.reduce((a, b) => a + b, 0) / avg90.length : null;
    const prixMoyen180j = avg180.length > 0 ? avg180.reduce((a, b) => a + b, 0) / avg180.length : null;

    // Calcul des ventes estimées
    const monthlySold = stats.monthlySold || 0;
    const salesRankDrops30 = stats.salesRankDrops30 || 0;
    const salesRankDrops90 = stats.salesRankDrops90 || 0;
    
    // Debug temporaire pour voir les données brutes de ventes
    console.log('📊 Données de ventes brutes Keepa:', {
      monthlySold: stats.monthlySold,
      salesRankDrops30: stats.salesRankDrops30,
      salesRankDrops90: stats.salesRankDrops90,
      salesRank: productData.salesRank,
      availableStats: Object.keys(stats)
    });

    // Calcul du ROI
    let roiCalculations = {};
    
    if (prixAmazonActuel && prixAmazonActuel > prixTTC) {
      const beneficeBrut = prixAmazonActuel - prixTTC;
      const fraisAmazon = prixAmazonActuel * (productData.referralFeePercent / 100);
      const fraisFBA = 3; // Estimation des frais FBA (à ajuster selon le produit)
      const beneficeNet = beneficeBrut - fraisAmazon - fraisFBA;
      const roiPourcentage = (beneficeNet / prixTTC) * 100;

      roiCalculations = {
        prixVente: prixAmazonActuel,
        prixAchat: prixTTC,
        beneficeBrut: beneficeBrut,
        fraisAmazon: fraisAmazon,
        fraisFBA: fraisFBA,
        beneficeNet: beneficeNet,
        roiPourcentage: roiPourcentage,
        rentable: roiPourcentage > 15 // Seuil de rentabilité à 15%
      };
      }
  
  } catch (error) {
    console.error('Erreur lors du calcul ROI Keepa:', error);
    return {
      success: false,
      error: error.message,
      ean: ean,
      prixHT: prixHT,
      prixTTC: prixHT * 1.20
    };
  }
}

// Fonction pour calculer les frais FBA et de port réels
function calculerFraisFBAEtPort(product, prixVente) {
  // Extraire les dimensions et poids du produit (si disponibles)
  const dimensions = product.packageDimensions || {};
  const poids = product.packageWeight || product.itemWeight || 0;
  
  // Dimensions en cm et poids en kg
  const longueur = dimensions.length || 0;
  const largeur = dimensions.width || 0; 
  const hauteur = dimensions.height || 0;
  const poidsKg = poids / 1000; // Convertir grammes en kg
  
  // Calcul du volume en cm³
  const volume = longueur * largeur * hauteur;
  
  // Grille des frais FBA Amazon France 2024 (en euros)
  let fraisFBA = 0;
  let fraisPort = 0;
  let categorieTaille = 'Standard';
  let details = {};
  
  // Déterminer la catégorie de taille selon les critères Amazon
  if (longueur <= 23 && largeur <= 17.5 && hauteur <= 3 && poidsKg <= 0.46) {
    // Petit format standard
    categorieTaille = 'Petit format standard';
    fraisFBA = 2.30;
    fraisPort = 1.50;
  } else if (longueur <= 35 && largeur <= 25 && hauteur <= 12 && poidsKg <= 2) {
    // Grand format standard  
    categorieTaille = 'Grand format standard';
    fraisFBA = 3.10;
    fraisPort = 2.20;
  } else if (longueur <= 45 && largeur <= 35 && hauteur <= 20 && poidsKg <= 10) {
    // Petit format volumineux
    categorieTaille = 'Petit format volumineux';
    fraisFBA = 4.50;
    fraisPort = 3.50;
  } else if (longueur <= 61 && largeur <= 46 && hauteur <= 46 && poidsKg <= 20) {
    // Grand format volumineux
    categorieTaille = 'Grand format volumineux';
    fraisFBA = 6.20;
    fraisPort = 4.80;
  } else {
    // Très grand format ou très lourd
    categorieTaille = 'Format spécial/volumineux';
    fraisFBA = Math.max(8.50, poidsKg * 0.85); // Minimum 8.50€ ou 0.85€/kg
    fraisPort = Math.max(6.00, poidsKg * 0.45); // Minimum 6€ ou 0.45€/kg
  }
  
  // Si pas de données de dimensions, estimation basée sur le prix
  if (volume === 0 && prixVente) {
    if (prixVente < 15) {
      categorieTaille = 'Petit format (estimé)';
      fraisFBA = 2.50;
      fraisPort = 1.80;
    } else if (prixVente < 50) {
      categorieTaille = 'Format moyen (estimé)';
      fraisFBA = 3.50;
      fraisPort = 2.50;
    } else {
      categorieTaille = 'Grand format (estimé)';
      fraisFBA = 5.00;
      fraisPort = 3.50;
    }
  }
  
  // Ajouter les frais de stockage mensuels (estimation)
  const fraisStockage = Math.min(prixVente * 0.01, 2.00); // Max 2€/mois
  fraisFBA += fraisStockage;
  
  details = {
    categorieTaille: categorieTaille,
    dimensions: {
      longueur: longueur,
      largeur: largeur,
      hauteur: hauteur,
      volume: volume
    },
    poids: poidsKg,
    fraisBase: fraisFBA - fraisStockage,
    fraisStockage: fraisStockage,
    estimation: volume === 0 ? 'Basée sur le prix (pas de dimensions)' : 'Basée sur les dimensions réelles'
  };
  
  return {
    fraisFBA: Number(fraisFBA.toFixed(2)),
    fraisPort: Number(fraisPort.toFixed(2)),
    details: details
  };
}

// Fonction pour traiter les données Keepa une fois qu'un produit est trouvé
async function processKeepaProduct(data, ean, prixHT, prixTTC, domain) {
  const product = data.products[0];
  
  // Extraction des données importantes du produit
  const productData = {
    asin: product.asin,
    title: product.title || 'Titre non disponible',
    brand: product.brand || 'Marque non disponible',
    categoryTree: product.categoryTree || [],
    salesRank: product.salesRanks ? Object.values(product.salesRanks)[0] : null,
    referralFeePercent: product.referralFeePercent || product.referralFeePercentage || 15,
    domain: domain.name,
    domainCode: domain.code
  };

  // Extraction des données de variations
  const variationsData = {
    nombreVariations: 0,
    variationCSV: product.variationCSV || null,
    variations: product.variations || [],
    parentAsin: product.parentAsin || null
  };

  // Calculer le nombre de variations
  if (product.variations && product.variations.length > 0) {
    variationsData.nombreVariations = product.variations.length;
  } else if (product.variationCSV) {
    // Si pas de détails mais qu'il y a un CSV, compter les ASIN
    variationsData.nombreVariations = product.variationCSV.split(',').filter(asin => asin.trim()).length;
  }

  // Ajouter des informations détaillées sur les variations
  if (product.variations && product.variations.length > 0) {
    variationsData.variationsDetails = product.variations.map(variation => ({
      asin: variation.asin,
      attributes: variation.attributes ? variation.attributes.reduce((acc, attr) => {
        acc[attr.dimension] = attr.value;
        return acc;
      }, {}) : {}
    }));
  }

  // Extraction des données de prix et stock
  const stats = product.stats || {};
  const current = stats.current || [];
  
  // Récupérer le prix Amazon actuel (buyBoxPrice)
  let prixAmazonActuel = null;
  if (stats.buyBoxPrice && stats.buyBoxPrice > 0) {
    prixAmazonActuel = stats.buyBoxPrice / 100; // Convertir de centimes en euros
  } else if (current.length >= 2 && current[1] > 0) {
    prixAmazonActuel = current[1] / 100; // Prix dans le tableau current
  }

  // Calcul des moyennes de prix sur différentes périodes
  const avg30 = stats.avg30 ? stats.avg30.map(price => price > 0 ? price / 100 : null).filter(p => p !== null) : [];
  const avg90 = stats.avg90 ? stats.avg90.map(price => price > 0 ? price / 100 : null).filter(p => p !== null) : [];
  const avg180 = stats.avg180 ? stats.avg180.map(price => price > 0 ? price / 100 : null).filter(p => p !== null) : [];

  const prixMoyen30j = avg30.length > 0 ? avg30.reduce((a, b) => a + b, 0) / avg30.length : null;
  const prixMoyen90j = avg90.length > 0 ? avg90.reduce((a, b) => a + b, 0) / avg90.length : null;
  const prixMoyen180j = avg180.length > 0 ? avg180.reduce((a, b) => a + b, 0) / avg180.length : null;

  // Calcul des ventes estimées - UTILISER LES SALES RANK DROPS (vraies données)
  const salesRankDrops30 = stats.salesRankDrops30 || 0;   // Ventes estimées 30 jours
  const salesRankDrops90 = stats.salesRankDrops90 || 0;   // Ventes estimées 90 jours
  const salesRankDrops180 = stats.salesRankDrops180 || 0; // Ventes estimées 180 jours
  const salesRankDrops365 = stats.salesRankDrops365 || 0; // Ventes estimées 365 jours
  
  // Debug pour voir les vraies données de ventes (Sales Rank Drops)
  console.log('📊 Sales Rank Drops - Vraies données de ventes Keepa:', {
    ventes30jours: salesRankDrops30,
    ventes90jours: salesRankDrops90,
    ventes180jours: salesRankDrops180,
    ventes365jours: salesRankDrops365,
    salesRank: productData.salesRank,
    availableStats: Object.keys(stats)
  });

  // Calcul des frais FBA et de port selon les données Amazon réelles
  const fraisData = calculerFraisFBAEtPort(product, prixAmazonActuel);
  
  // Calcul du ROI selon la méthode spécifiée (HT/TTC séparés)
  let roiCalculations = {};
  
  if (prixAmazonActuel && prixAmazonActuel > prixTTC) {
    // Prix Amazon Keepa est en TTC
    const prixVenteTTC = prixAmazonActuel;
    
    // Conversion du prix de vente en HT
    const prixVenteHT = prixVenteTTC / 1.2;
    
    // Frais Amazon calculés sur le TTC puis convertis en HT
    const fraisAmazonTTC = prixVenteTTC * (productData.referralFeePercent / 100);
    const fraisAmazonHT = fraisAmazonTTC / 1.2;
    
    // Frais FBA sont en TTC, conversion en HT
    const fraisFBATTC = fraisData.fraisFBA;
    const fraisFBAHT = fraisFBATTC / 1.2;
    
    // Frais de port sont en TTC, conversion en HT  
    const fraisPortTTC = fraisData.fraisPort;
    const fraisPortHT = fraisPortTTC / 1.2;
    
    // Calcul du bénéfice net HT
    // Bénéfice net HT = Prix vente HT - Prix achat HT - Frais Amazon HT - Frais FBA HT - Frais port HT
    const beneficeNetHT = prixVenteHT - prixHT - fraisAmazonHT - fraisFBAHT - fraisPortHT;
    
    // ROI net HT = (Bénéfice net HT / Prix achat HT) × 100
    const roiPourcentageHT = (beneficeNetHT / prixHT) * 100;

    roiCalculations = {
      // Prix en TTC
      prixVenteTTC: prixVenteTTC,
      prixAchatTTC: prixTTC,
      
      // Prix en HT
      prixVenteHT: prixVenteHT,
      prixAchatHT: prixHT,
      
      // Frais en TTC
      fraisTTC: {
        amazon: fraisAmazonTTC,
        fba: fraisFBATTC,
        port: fraisPortTTC,
        total: fraisAmazonTTC + fraisFBATTC + fraisPortTTC
      },
      
      // Frais en HT
      fraisHT: {
        amazon: fraisAmazonHT,
        fba: fraisFBAHT,
        port: fraisPortHT,
        total: fraisAmazonHT + fraisFBAHT + fraisPortHT
      },
      
      fraisDetails: fraisData.details,
      beneficeNetHT: beneficeNetHT,
      roiPourcentageHT: roiPourcentageHT,
      rentable: roiPourcentageHT > 15, // Seuil de rentabilité à 15%
      
      // Détail du calcul pour transparence
      calculDetail: {
        prixVenteHT: `${prixVenteTTC.toFixed(2)}€ TTC ÷ 1.2 = ${prixVenteHT.toFixed(2)}€ HT`,
        fraisAmazonHT: `${fraisAmazonTTC.toFixed(2)}€ TTC ÷ 1.2 = ${fraisAmazonHT.toFixed(2)}€ HT`,
        fraisFBAHT: `${fraisFBATTC.toFixed(2)}€ TTC ÷ 1.2 = ${fraisFBAHT.toFixed(2)}€ HT`,
        fraisPortHT: `${fraisPortTTC.toFixed(2)}€ TTC ÷ 1.2 = ${fraisPortHT.toFixed(2)}€ HT`,
        beneficeCalcul: `${prixVenteHT.toFixed(2)} - ${prixHT.toFixed(2)} - ${fraisAmazonHT.toFixed(2)} - ${fraisFBAHT.toFixed(2)} - ${fraisPortHT.toFixed(2)} = ${beneficeNetHT.toFixed(2)}€ HT`,
        roiCalcul: `(${beneficeNetHT.toFixed(2)} ÷ ${prixHT.toFixed(2)}) × 100 = ${roiPourcentageHT.toFixed(2)}%`
      }
    };
  }

  return {
      success: true,
      ean: ean,
      prixHT: prixHT,
      prixTTC: prixTTC,
      product: productData,
      prix: {
        actuel: prixAmazonActuel,
        moyen30j: prixMoyen30j,
        moyen90j: prixMoyen90j,
        moyen180j: prixMoyen180j
      },
      ventes: {
        mensuellesEstimees: salesRankDrops30,        // ✅ Utiliser Sales Rank Drops 30j (vraies ventes)
        rankDrops30j: salesRankDrops30,             // ✅ Ventes 30 jours  
        rankDrops90j: salesRankDrops90,             // ✅ Ventes 90 jours
        rankDrops180j: salesRankDrops180,           // ✅ Ventes 180 jours  
        rankDrops365j: salesRankDrops365            // ✅ Ventes 365 jours
      },
      roi: roiCalculations,
      variations: variationsData,
      tokensLeft: data.tokensLeft || 0,
      timestamp: new Date().toISOString()
    };
}

// Nouvelle route API pour calculer le ROI via Keepa
app.post('/api/keepa-roi', async (req, res) => {
  try {
    const { ean, prixHT } = req.body;
    
    // Validation des paramètres
    if (!ean || !prixHT) {
      return res.status(400).json({
        success: false,
        error: 'Le code EAN et le prix HT sont requis'
      });
    }

    // Validation du format EAN
    if (!/^\d{8,14}$/.test(ean)) {
      return res.status(400).json({
        success: false,
        error: 'Le code EAN doit être composé de 8 à 14 chiffres'
      });
    }

    // Validation du prix
    const prix = parseFloat(prixHT);
    if (isNaN(prix) || prix <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Le prix HT doit être un nombre positif'
      });
    }

    console.log(`🔍 Nouvelle demande ROI Keepa - EAN: ${ean}, Prix HT: ${prix}€`);

    // Appel de la fonction de calcul ROI Keepa
    const result = await calculROIKEEPA(ean, prix);

    // Incrémenter le compteur si le calcul est réussi
    if (result.success) {
      try {
        await db.run(
          'UPDATE counter SET counter = counter + 1, date = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM counter ORDER BY id DESC LIMIT 1)'
        );
      } catch (counterError) {
        console.error('Erreur lors de l\'incrémentation du compteur:', counterError);
        // Ne pas faire échouer la requête pour une erreur de compteur
      }
    }

    // Retourner le résultat
    if (result.success) {
      console.log(`✅ ROI Keepa calculé avec succès pour ${ean}`);
      res.json(result);
    } else {
      console.log(`❌ Échec du calcul ROI Keepa pour ${ean}: ${result.error}`);
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Erreur lors du calcul du ROI Keepa:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors du calcul du ROI'
        });
    }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌐 Interface web: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Endpoint ROI: POST http://localhost:${PORT}/api/roi`);
  console.log(`🔍 Endpoint Keepa ROI: POST http://localhost:${PORT}/api/keepa-roi`);
  
  // Nettoyage initial des fichiers temporaires Puppeteer
  console.log('🧹 Nettoyage des fichiers temporaires Puppeteer...');
  cleanupPuppeteerTempFiles();
  
  // Programmer un nettoyage automatique toutes les heures
  setInterval(() => {
    console.log('🧹 Nettoyage périodique des fichiers temporaires Puppeteer...');
    cleanupPuppeteerTempFiles();
  }, 60 * 60 * 1000); // 1 heure
  
  // Note: Le système utilise maintenant les credentials de la base de données
  console.log('ℹ️  Le système utilise les credentials configurés dans la base de données');
});

// Nettoyage lors de la fermeture du serveur
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  console.log('🧹 Nettoyage final des fichiers temporaires Puppeteer...');
  cleanupPuppeteerTempFiles();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du serveur...');
  console.log('🧹 Nettoyage final des fichiers temporaires Puppeteer...');
  cleanupPuppeteerTempFiles();
  process.exit(0);
}); 