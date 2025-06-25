const fs = require('fs');

// Lire le fichier server.js
let content = fs.readFileSync('server.js', 'utf8');

// Chercher et remplacer dans la seconde fonction calculROIKEEPA (celle utilisée)
const oldProductData = `    // Extraction des données importantes du produit
    const productData = {
      asin: product.asin,
      title: product.title || 'Titre non disponible',
      brand: product.brand || 'Marque non disponible',
      categoryTree: product.categoryTree || [],
      salesRank: product.salesRanks ? Object.values(product.salesRanks)[0] : null,
      referralFeePercent: product.referralFeePercent || product.referralFeePercentage || 15
    };

    // Extraction des données de prix et stock`;

const newProductData = `    // Extraction des données importantes du produit
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

    // Extraction des données de prix et stock`;

// Remplacer la dernière occurrence (celle utilisée)
const lastIndex = content.lastIndexOf(oldProductData);
if (lastIndex !== -1) {
  content = content.substring(0, lastIndex) + newProductData + content.substring(lastIndex + oldProductData.length);
}

// Ajouter les variations dans le return
const oldReturn = `      roi: roiCalculations,
      tokensLeft: data.tokensLeft || 0,
      timestamp: new Date().toISOString()
    };`;

const newReturn = `      roi: roiCalculations,
      variations: variationsData,
      tokensLeft: data.tokensLeft || 0,
      timestamp: new Date().toISOString()
    };`;

// Remplacer la dernière occurrence
const lastReturnIndex = content.lastIndexOf(oldReturn);
if (lastReturnIndex !== -1) {
  content = content.substring(0, lastReturnIndex) + newReturn + content.substring(lastReturnIndex + oldReturn.length);
}

// Écrire le fichier modifié
fs.writeFileSync('server.js', content);

console.log('✅ Modifications apportées pour ajouter les données de variations'); 