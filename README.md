# 📊 Calculateur ROI Amazon avec Keepa - Documentation

## 🎯 Objectif

Ce système calcule automatiquement le **Retour sur Investissement (ROI)** de produits Amazon en utilisant l'API Keepa pour obtenir des données précises de prix et de ventes. Il inclut maintenant le **calcul précis des frais FBA et de livraison** selon les tarifs Amazon officiels 2024.

## 🚀 Installation et Configuration

### Prérequis

- **Node.js** (v16 ou supérieur)
- **Token API Keepa** (inscription sur keepa.com)
- **SQLite** (inclus avec Node.js)

### Installation

```bash
# Cloner le projet
git clone <repository-url>
cd scrapping-products

# Installer les dépendances
npm install

# Configurer les variables d'environnement
echo "TOKEN_KEEPA=votre_token_keepa_ici" > .env
echo "ADMIN_USERNAME=admin" >> .env
echo "ADMIN_PASSWORD=Scrapping2025!" >> .env
echo "SESSION_SECRET=votre_secret_session" >> .env

# Démarrer le serveur
PORT=3001 node server.js
```

### Configuration du Token Keepa

1. Créer un compte sur [keepa.com](https://keepa.com)
2. Aller dans **Account Settings > API**
3. Copier votre token API
4. L'ajouter dans le fichier `.env`

```bash
TOKEN_KEEPA=458ekhh7olf141smoo6j39eh1vasu30dg4g1i4ci7h2ou5qrmglo0hcgnaipca26
```

### Accès à l'Interface

- **Interface principale** : http://localhost:3001/keepa-roi
- **Login admin** : http://localhost:3001/login
- **API Health Check** : http://localhost:3001/api/health

## 🔍 Comment ça fonctionne

### 1. Recherche Multi-Domaines Européens

Le système effectue une recherche intelligente sur **5 marketplaces Amazon européens** dans cet ordre de priorité :

1. **🇫🇷 France** (amazon.fr) - Domain 4
2. **🇩🇪 Allemagne** (amazon.de) - Domain 3  
3. **🇪🇸 Espagne** (amazon.es) - Domain 9
4. **🇮🇹 Italie** (amazon.it) - Domain 8
5. **🇬🇧 Royaume-Uni** (amazon.co.uk) - Domain 2

**Stratégie :** La recherche s'arrête dès qu'un produit est trouvé sur un marketplace, garantissant le meilleur taux de succès possible.

### 2. Source des Données : API Keepa

L'API Keepa (`stats=1`) retourne des données complètes incluant :

- **Prix actuels et historiques**
- **Ventes mensuelles estimées** (`monthlySold`)
- **Drops de rang de vente** (indicateurs de ventes)
- **Frais de commission Amazon** par catégorie
- **Données de variations** (couleurs, tailles, etc.)

## 💰 Méthodologie de Calcul ROI (Méthode HT/TTC Française)

### Étape 1 : Conversion du Prix d'Achat

```javascript
Prix achat TTC = Prix achat HT × 1.20  // TVA française à 20%
```

### Étape 2 : Récupération du Prix Amazon Keepa

Le système recherche le prix Amazon actuel dans cet ordre :
1. `stats.buyBoxPrice` (prix de la Buy Box)
2. `stats.current[1]` (prix dans le tableau current)

**Note :** Les prix Keepa sont en centimes et sont divisés par 100. Ce prix récupéré est considéré comme **TTC**.

### Étape 3 : Conversions HT/TTC pour le Calcul

```javascript
// Prix de vente Amazon en HT
Prix vente HT = Prix Amazon Keepa (TTC) ÷ 1.2

// Frais Amazon calculés sur le TTC puis convertis en HT
Frais Amazon TTC = Prix Amazon Keepa × (% Commission / 100)
Frais Amazon HT = Frais Amazon TTC ÷ 1.2

// Frais FBA et port calculés selon dimensions puis convertis en HT
Frais FBA HT = Frais FBA TTC ÷ 1.2
Frais port HT = Frais port TTC ÷ 1.2
```

### Étape 4 : Calcul du ROI Net HT

```javascript
Bénéfice net HT = Prix vente HT - Prix achat HT - Frais Amazon HT - Frais FBA HT - Frais port HT

ROI net HT (%) = (Bénéfice net HT ÷ Prix achat HT) × 100
```

### Seuil de Rentabilité

- **Rentable :** ROI net HT > 15%
- **Non rentable :** ROI net HT ≤ 15%

## 📦 Calcul Avancé des Frais FBA et Livraison

### Grille Tarifaire Amazon France 2024

Le système calcule automatiquement les frais selon les **dimensions et poids réels** :

| Catégorie | Dimensions Max | Poids Max | Frais FBA | Frais Port |
|-----------|----------------|-----------|-----------|------------|
| **Petit format standard** | 23×17.5×3 cm | 460g | 2.30€ | 1.50€ |
| **Grand format standard** | 35×25×12 cm | 2kg | 3.10€ | 2.20€ |
| **Petit format volumineux** | 45×35×20 cm | 10kg | 4.50€ | 3.50€ |
| **Grand format volumineux** | 61×46×46 cm | 20kg | 6.20€ | 4.80€ |
| **Format spécial** | Au-delà | >20kg | 8.50€ min | 6.00€ min |

### Frais Additionnels

- **Stockage mensuel** : 1% du prix de vente (max 2€/mois)
- **Estimation par prix** : Si pas de dimensions, estimation basée sur le prix de vente

### Exemple de Calcul Complet

```
Prix d'achat HT : 25.00€
Prix Amazon Keepa (TTC) : 45.99€
Prix vente HT = 45.99 ÷ 1.2 = 38.33€
Frais Amazon (15% du TTC) : 45.99 × 15% = 6.90€ TTC
Frais Amazon HT = 6.90 ÷ 1.2 = 5.75€
Frais FBA (livraison) TTC : 3.00€
Frais FBA HT = 3.00 ÷ 1.2 = 2.50€

Bénéfice net HT = 38.33 - 25.00 - 5.75 - 2.50 = 5.08€
ROI net HT = (5.08 ÷ 25.00) × 100 = 20.32%
```

## 📈 Données de Performance

### Ventes Estimées (Sales Rank Drops)

Le système utilise les **vraies données de ventes Keepa** :

- **`salesRankDrops30`** : Ventes estimées sur 30 jours (données fiables)
- **`salesRankDrops90`** : Ventes estimées sur 90 jours
- **`salesRankDrops180`** : Ventes estimées sur 180 jours
- **`salesRankDrops365`** : Ventes estimées sur 365 jours

**Note :** Les "Sales Rank Drops" sont des indicateurs très fiables de ventes réelles, plus précis que les estimations génériques.

### Prix Historiques

- **Prix moyen 30 jours** : Moyenne des prix sur le dernier mois
- **Prix moyen 90 jours** : Moyenne des prix sur le dernier trimestre  
- **Prix moyen 180 jours** : Moyenne des prix sur les 6 derniers mois

### Données de Variations de Produit

- **Nombre de variations** : Nombre total de variantes (couleurs, tailles, etc.)
- **Détails des variations** : ASIN et attributs de chaque variante
- **ASIN parent** : ASIN du produit principal si c'est une variation

## 🔧 Variables et Paramètres

### Variables d'Environnement

```bash
TOKEN_KEEPA=votre_token_keepa_api
```

### Paramètres d'Entrée

- **EAN** : Code-barres du produit (8-14 chiffres)
- **Prix HT** : Prix d'achat hors taxes en euros

### Paramètres de Configuration

```javascript
// Taux de TVA français
const TVA_RATE = 1.20;

// Frais FBA calculés dynamiquement selon dimensions et poids
// Seuil de rentabilité ROI HT
const SEUIL_RENTABILITE = 15;

// Domaines Amazon testés par ordre de priorité
const DOMAINS_TO_TRY = [
  { code: '4', name: 'France (amazon.fr)', priority: 1 },
  { code: '3', name: 'Allemagne (amazon.de)', priority: 2 },
  { code: '9', name: 'Espagne (amazon.es)', priority: 3 },
  { code: '8', name: 'Italie (amazon.it)', priority: 4 },
  { code: '2', name: 'Royaume-Uni (amazon.co.uk)', priority: 5 }
];
```

## 🌍 Domaines Amazon Supportés

| Pays | Marketplace | Code Domaine | Priorité |
|------|-------------|--------------|----------|
| France | amazon.fr | 4 | 1️⃣ |
| Allemagne | amazon.de | 3 | 2️⃣ |
| Espagne | amazon.es | 9 | 3️⃣ |
| Italie | amazon.it | 8 | 4️⃣ |
| Royaume-Uni | amazon.co.uk | 2 | 5️⃣ |

## 📝 Format de Réponse API

### Succès

```json
{
  "success": true,
  "ean": "1234567890123",
  "prixHT": 25.00,
  "prixTTC": 30.00,
  "product": {
    "asin": "B08N5WRWNW",
    "title": "Nom du produit",
    "brand": "Marque",
    "domain": "France (amazon.fr)",
    "domainCode": "4",
    "referralFeePercent": 15
  },
  "prix": {
    "actuel": 45.99,
    "moyen30j": 42.50,
    "moyen90j": 40.25,
    "moyen180j": 38.75
  },
  "ventes": {
    "mensuellesEstimees": 150,
    "rankDrops30j": 25,
    "rankDrops90j": 75,
    "rankDrops180j": 145,
    "rankDrops365j": 580
  },
  "roi": {
    "prixVenteTTC": 45.99,
    "prixAchatTTC": 30.00,
    "prixVenteHT": 38.33,
    "prixAchatHT": 25.00,
    "fraisTTC": {
      "amazon": 6.90,
      "fba": 3.10,
      "port": 2.20,
      "total": 12.20
    },
    "fraisHT": {
      "amazon": 5.75,
      "fba": 2.58,
      "port": 1.83,
      "total": 10.16
    },
    "fraisDetails": {
      "categorieTaille": "Grand format standard",
      "dimensions": { "longueur": 15, "largeur": 10, "hauteur": 12, "volume": 1800 },
      "poids": 0.25,
      "fraisBase": 3.10,
      "fraisStockage": 0.46,
      "estimation": "Basée sur les dimensions réelles"
    },
    "beneficeNetHT": 2.42,
    "roiPourcentageHT": 9.68,
    "rentable": false,
    "calculDetail": {
      "prixVenteHT": "45.99€ TTC ÷ 1.2 = 38.33€ HT",
      "fraisAmazonHT": "6.90€ TTC ÷ 1.2 = 5.75€ HT",
      "fraisFBAHT": "3.10€ TTC ÷ 1.2 = 2.58€ HT",
      "fraisPortHT": "2.20€ TTC ÷ 1.2 = 1.83€ HT",
      "beneficeCalcul": "38.33 - 25.00 - 5.75 - 2.58 - 1.83 = 2.42€ HT",
      "roiCalcul": "(2.42 ÷ 25.00) × 100 = 9.68%"
    }
  },
  "variations": {
    "nombreVariations": 5,
    "variationCSV": "B08N5WRWNW,B08N5WRWNY,B08N5WRWNZ",
    "variationsDetails": [
      {
        "asin": "B08N5WRWNY",
        "attributes": {
          "Color": "Rouge",
          "Size": "Large"
        }
      }
    ],
    "parentAsin": "B08N5WRWNW"
  },
  "tokensLeft": 1195,
  "timestamp": "2025-01-15T10:30:45.123Z"
}
```

### Échec

```json
{
  "success": false,
  "error": "Aucun produit trouvé pour cet EAN sur tous les marketplaces",
  "ean": "1234567890123",
  "debug": {
    "domainsTestedCount": 5,
    "detailedDebug": [...]
  }
}
```

## 🚀 Utilisation

### Interface Web

Accès via navigateur : `http://localhost:3001/keepa-roi`

**Fonctionnalités disponibles :**
- **Formulaire d'analyse** : Saisie EAN + Prix HT
- **Bouton démonstration** : "🧪 Voir exemple détaillé des frais"
- **Affichage détaillé** : ROI HT/TTC, frais ventilés, dimensions, calculs step-by-step
- **Données de variations** : Nombre et détails des variantes produit

### API REST

```bash
POST /api/keepa-roi
Content-Type: application/json

{
  "ean": "1234567890123",
  "prixHT": 25.00
}
```

### API de Démonstration

```bash
GET /api/keepa-roi/demo
```

Retourne un exemple complet avec calculs de frais FBA réels selon dimensions.

## 🔬 Debug et Monitoring

Le système génère des logs détaillés :

- **Recherche par domaine** : Quel marketplace est testé
- **Données brutes Keepa** : Réponse complète de l'API
- **Calculs intermédiaires** : Chaque étape du calcul ROI HT/TTC
- **Erreurs par domaine** : Détail des échecs de recherche
- **Consommation tokens** : Suivi des tokens Keepa restants

### Gestion des Tokens Keepa

- **Coût par requête** : 1 token par requête produit
- **Affichage tokens restants** : Dans chaque réponse API
- **Optimisation** : Arrêt dès le premier marketplace trouvé
- **Monitoring** : Logs de consommation pour suivi

**Exemple de logs :**
```
🔍 Nouvelle demande ROI Keepa - EAN: 3760260453219, Prix HT: 25.5€
🌍 Recherche sur France (amazon.fr) (domain=4) pour EAN: 3760260453219
✅ Produit trouvé sur France (amazon.fr) !
📊 Tokens Keepa restants: 1199
✅ ROI Keepa calculé avec succès pour 3760260453219
```

## ⚠️ Limitations

1. **Données Keepa dépendantes** : La qualité dépend de la disponibilité sur chaque marketplace
2. **Commission Amazon** : Basée sur les données Keepa ou 15% par défaut si non disponible
3. **Recherche séquentielle** : Testée domaine par domaine (optimisé par priorité)
4. **Estimation frais sans dimensions** : Si pas de données produit, estimation basée sur le prix

## ✅ Nouvelles Fonctionnalités 2024

- ✅ **Calcul ROI HT/TTC** selon méthode comptable française
- ✅ **Frais FBA dynamiques** basés sur dimensions et poids réels
- ✅ **Grille tarifaire Amazon France 2024** intégrée
- ✅ **Frais de port séparés** des frais FBA
- ✅ **Frais de stockage mensuel** inclus
- ✅ **Détail step-by-step** de tous les calculs
- ✅ **Données de variations** complètes (ASIN, attributs)
- ✅ **Sales Rank Drops** comme indicateur de ventes fiable
- ✅ **Interface de démonstration** avec exemple complet

## 🔄 Évolutions Possibles

- Intégration SP-API Amazon pour données temps réel
- Ajout de marketplaces non-européens (US, CA, JP)
- Optimisation parallèle des recherches multi-domaines
- Historique et tendances de ROI
- Alertes automatiques sur seuils de rentabilité
- Export des analyses en CSV/Excel 