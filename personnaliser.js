const puppeteer = require('puppeteer');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Fonction pour poser une question et obtenir une réponse
function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

// Fonction principale
async function main() {
  try {
    // Demande l'URL du site à l'utilisateur
    const url = await question('Entrez l\'URL du site à analyser : ');
    
    console.log(`\nAnalyse de ${url}...\n`);
    
    const browser = await puppeteer.launch({
      headless: false,  // Mode visible pour mieux comprendre
      defaultViewport: { width: 1366, height: 768 }
    });
    
    const page = await browser.newPage();
    
    console.log('Chargement de la page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('\nAnalyse des sélecteurs potentiels...');
    
    // Cherche des sélecteurs potentiels pour les produits
    const selecteurs = await page.evaluate(() => {
      const resultat = {};
      
      // Cherche les sélecteurs de produits potentiels
      const produitsPotentiels = [
        '.product', '.item', '[class*="product"]', '[class*="item"]', 
        'article', '.card', '[class*="card"]', '.produit', '[class*="produit"]'
      ];
      
      // Compte le nombre d'éléments pour chaque sélecteur
      produitsPotentiels.forEach(selecteur => {
        const elements = document.querySelectorAll(selecteur);
        if (elements.length > 0) {
          resultat[selecteur] = elements.length;
        }
      });
      
      return resultat;
    });
    
    console.log('\nSélecteurs potentiels pour les produits:');
    console.log('--------------------------------------');
    
    if (Object.keys(selecteurs).length === 0) {
      console.log('Aucun sélecteur de produit générique trouvé. Vous devrez analyser manuellement la structure HTML.');
    } else {
      for (const [selecteur, count] of Object.entries(selecteurs)) {
        console.log(`${selecteur}: ${count} éléments trouvés`);
      }
    }
    
    // Demande quel sélecteur tester
    const selecteurChoisi = await question('\nEntrez le sélecteur à tester (ou appuyez sur Entrée pour quitter) : ');
    
    if (selecteurChoisi) {
      // Teste le sélecteur choisi
      const exemples = await page.evaluate((selecteur) => {
        const elements = document.querySelectorAll(selecteur);
        const resultat = [];
        
        // Prend jusqu'à 3 exemples
        for (let i = 0; i < Math.min(3, elements.length); i++) {
          const element = elements[i];
          
          // Essaye de trouver le nom du produit
          const nomElement = element.querySelector('h2, h3, h4, .name, .title, [class*="name"], [class*="title"]');
          const nom = nomElement ? nomElement.innerText.trim() : 'Non trouvé';
          
          // Essaye de trouver le prix
          const prixElement = element.querySelector('.price, [class*="price"]');
          const prix = prixElement ? prixElement.innerText.trim() : 'Non trouvé';
          
          resultat.push({ nom, prix });
        }
        
        return resultat;
      }, selecteurChoisi);
      
      console.log('\nExemples de produits trouvés:');
      console.log('---------------------------');
      
      exemples.forEach((exemple, index) => {
        console.log(`\nProduit ${index + 1}:`);
        console.log(`Nom: ${exemple.nom}`);
        console.log(`Prix: ${exemple.prix}`);
      });
      
      console.log('\nPour personnaliser le script index.js:');
      console.log('-----------------------------------');
      console.log(`1. Modifiez la ligne contenant "const produitsElements" pour utiliser "${selecteurChoisi}"`);
      console.log('2. Ajustez les sélecteurs pour le nom, prix, etc. en fonction des résultats ci-dessus');
    }
    
    await browser.close();
    console.log('\nAnalyse terminée.');
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    rl.close();
  }
}

main(); 