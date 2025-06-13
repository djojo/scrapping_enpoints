const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour parser JSON
app.use(express.json());

// Servir les fichiers statiques depuis le dossier 'public'
app.use(express.static('public'));

// Fonction pour simuler un délai humain
function delaiHumain(min = 500, max = 2000) {
  const delai = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delai));
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
async function calculerROI(code, prix) {
  console.log(`Calcul du ROI pour le code: ${code} avec le prix: ${prix}`);
  
  // Configuration adaptative selon l'environnement
  const isLinux = process.platform === 'linux';
  const isMac = process.platform === 'darwin';
  
  let browserConfig = {
    headless: "new",
    defaultViewport: { width: 1366, height: 768 },
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
      '--window-size=1366,768'
    ]
  };

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
    await taperHumain(page, '#loginform-email', process.env.SELLERAMP_EMAIL);
    await delaiHumain(500, 1500);
    
    await page.hover('#loginform-password');
    await delaiHumain(200, 600);
    await taperHumain(page, '#loginform-password', process.env.SELLERAMP_PASSWORD);
    
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
    
    // Cliquer sur le champ pour le focus
    await page.click(prixSelector);
    await delaiHumain(200, 400);
    
    // Sélectionner tout le contenu existant et le remplacer
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await delaiHumain(100, 200);
    
    // Taper le nouveau prix caractère par caractère
    for (let char of prix.toString()) {
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
    }, prixSelector, prix.toString());
    
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

// Endpoint pour calculer le ROI
app.post('/api/roi', async (req, res) => {
  try {
    const { code, prix } = req.body;
    if (!code || !prix) {
      return res.status(400).json({
        success: false,
        error: 'Le code et le prix sont requis'
      });
    }
    const result = await calculerROI(code, prix);
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

// Route racine - redirection vers l'interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint de test
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API SellerAmp ROI fonctionne correctement',
    timestamp: new Date().toISOString()
  });
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
  
  // Vérifier que les variables d'environnement sont définies
  if (!process.env.SELLERAMP_EMAIL || !process.env.SELLERAMP_PASSWORD) {
    console.warn('⚠️  ATTENTION: Les variables SELLERAMP_EMAIL et SELLERAMP_PASSWORD doivent être définies dans le fichier .env');
  }
}); 