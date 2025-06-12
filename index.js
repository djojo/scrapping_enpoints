const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// Fonction pour lire le fichier sites.txt
async function lireSites() {
  try {
    const contenu = await fs.promises.readFile(path.join(__dirname, 'sites.txt'), 'utf8');
    return contenu.split('\n').filter(site => site.trim() !== '');
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier sites.txt:', error);
    return [];
  }
}

// Fonction pour extraire les produits d'un site
async function extraireProduits(url) {
  console.log(`Extraction des produits depuis: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1366, height: 768 }
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Attendre que le contenu de la page soit chargé
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Cette partie doit être adaptée selon la structure des sites que vous ciblez
    // Voici un exemple général qui tente de trouver des produits
    const produits = await page.evaluate(() => {
      // Cette fonction recherche des éléments qui pourraient être des produits
      // Ces sélecteurs doivent être ajustés en fonction des sites spécifiques
      const produitsElements = Array.from(document.querySelectorAll('.product, .item, [class*="product"], [class*="item"], article'));
      
      return produitsElements.map(element => {
        // Chercher le nom du produit
        const nomElement = element.querySelector('h2, h3, h4, .name, .title, [class*="name"], [class*="title"]');
        const nom = nomElement ? nomElement.innerText.trim() : 'Nom non trouvé';
        
        // Chercher le prix
        const prixElement = element.querySelector('.price, [class*="price"]');
        const prix = prixElement ? prixElement.innerText.trim() : 'Prix non trouvé';
        
        // Chercher l'image
        const imageElement = element.querySelector('img');
        const image = imageElement ? imageElement.src : '';
        
        // Chercher le lien
        const lienElement = element.querySelector('a') || element.closest('a');
        const lien = lienElement ? lienElement.href : '';
        
        return { nom, prix, image, lien };
      });
    });
    
    console.log(`${produits.length} produits trouvés sur ${url}`);
    return { url, produits };
  } catch (error) {
    console.error(`Erreur lors de l'extraction de ${url}:`, error);
    return { url, produits: [], erreur: error.message };
  } finally {
    await browser.close();
  }
}

// Fonction principale
async function main() {
  const sites = await lireSites();
  
  if (sites.length === 0) {
    console.log('Aucun site trouvé dans le fichier sites.txt. Veuillez ajouter des URLs au fichier.');
    return;
  }
  
  console.log(`${sites.length} sites trouvés. Début de l'extraction...`);
  
  const resultats = [];
  
  for (const site of sites) {
    try {
      const resultat = await extraireProduits(site);
      resultats.push(resultat);
    } catch (error) {
      console.error(`Erreur lors du traitement de ${site}:`, error);
      resultats.push({ url: site, produits: [], erreur: error.message });
    }
  }
  
  // Enregistrer les résultats dans un fichier JSON
  const nomFichier = `resultats_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  
  try {
    await fs.promises.writeFile(
      path.join(__dirname, nomFichier),
      JSON.stringify(resultats, null, 2),
      'utf8'
    );
    console.log(`Résultats enregistrés dans ${nomFichier}`);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des résultats:', error);
  }
}

// Exécuter le script
main().catch(error => {
  console.error('Erreur principale:', error);
  process.exit(1);
}); 