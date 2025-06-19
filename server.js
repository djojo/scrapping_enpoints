const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const session = require('express-session');
const db = require('./db');
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

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`🌐 Interface web: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Endpoint ROI: POST http://localhost:${PORT}/api/roi`);
  
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