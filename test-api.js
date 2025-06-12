// Script de test simple pour l'API SellerAmp ROI
const http = require('http');

// Configuration
const hostname = 'localhost';
const port = 3000;

// Fonction pour faire une requête POST
function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname,
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Fonction pour faire une requête GET
function makeGetRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      port,
      path,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// Tests
async function runTests() {
  console.log('🧪 Démarrage des tests API...\n');
  
  try {
    // Test 1: Health check
    console.log('1️⃣ Test Health Check...');
    const healthResponse = await makeGetRequest('/api/health');
    console.log('✅ Health check:', healthResponse);
    console.log('');
    
    // Test 2: Test avec paramètres manquants
    console.log('2️⃣ Test avec paramètres manquants...');
    const errorResponse = await makeRequest('/api/roi', {});
    console.log('✅ Erreur attendue:', errorResponse);
    console.log('');
    
    // Test 3: Test avec des paramètres valides (nécessite un .env configuré)
    console.log('3️⃣ Test avec paramètres valides...');
    console.log('⚠️  Ce test nécessite un fichier .env avec des credentials valides');
    const testResponse = await makeRequest('/api/roi', {
      code: '0020714146559',
      prix: 25.99
    });
    console.log('📊 Résultat:', testResponse);
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
  }
}

// Exécuter les tests
runTests(); 