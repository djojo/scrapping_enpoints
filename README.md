# 📊 Calculateur ROI Amazon - Documentation

## 🎯 Objectif

Ce système calcule automatiquement le **Retour sur Investissement (ROI)** de produits Amazon en utilisant l'API Keepa pour obtenir des données précises de prix et de ventes.

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

## 💰 Méthodologie de Calcul ROI

### Étape 1 : Conversion du Prix

```javascript
Prix TTC = Prix HT × 1.20  // TVA française à 20%
```

### Étape 2 : Récupération du Prix Amazon

Le système recherche le prix Amazon actuel dans cet ordre :
1. `stats.buyBoxPrice` (prix de la Buy Box)
2. `stats.current[1]` (prix dans le tableau current)

**Note :** Les prix Keepa sont en centimes et sont divisés par 100.

### Étape 3 : Calcul du ROI

```javascript
Bénéfice Brut = Prix Amazon - Prix TTC d'achat

Frais Amazon = Prix Amazon × (% Commission / 100)
// Commission varie par catégorie (généralement 8-15%)

Frais FBA = 3€  // Estimation fixe des frais de logistique

Bénéfice Net = Bénéfice Brut - Frais Amazon - Frais FBA

ROI (%) = (Bénéfice Net / Prix TTC) × 100
```

### Seuil de Rentabilité

- **Rentable :** ROI > 15%
- **Non rentable :** ROI ≤ 15%

## 📈 Données de Performance

### Ventes Estimées

Le système fournit plusieurs métriques de ventes :

- **`monthlySold`** : Ventes mensuelles estimées par Keepa
- **`salesRankDrops30`** : Nombre de chutes de rang sur 30 jours
- **`salesRankDrops90`** : Nombre de chutes de rang sur 90 jours

### Prix Historiques

- **Prix moyen 30 jours** : Moyenne des prix sur le dernier mois
- **Prix moyen 90 jours** : Moyenne des prix sur le dernier trimestre  
- **Prix moyen 180 jours** : Moyenne des prix sur les 6 derniers mois

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

// Frais FBA estimés (à ajuster selon le produit)
const FRAIS_FBA = 3;

// Seuil de rentabilité
const SEUIL_RENTABILITE = 15;
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
    "rankDrops90j": 75
  },
  "roi": {
    "prixVente": 45.99,
    "prixAchat": 30.00,
    "beneficeBrut": 15.99,
    "fraisAmazon": 6.90,
    "fraisFBA": 3.00,
    "beneficeNet": 6.09,
    "roiPourcentage": 20.30,
    "rentable": true
  },
  "variations": {
    "nombreVariations": 5,
    "variationsDetails": [...]
  }
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

Accès via navigateur : `http://localhost:3000/keepa-roi`

### API REST

```bash
POST /api/keepa-roi
Content-Type: application/json

{
  "ean": "1234567890123",
  "prixHT": 25.00
}
```

## 🔬 Debug et Monitoring

Le système génère des logs détaillés :

- **Recherche par domaine** : Quel marketplace est testé
- **Données brutes Keepa** : Réponse complète de l'API
- **Calculs intermédiaires** : Chaque étape du calcul ROI
- **Erreurs par domaine** : Détail des échecs de recherche

## ⚠️ Limitations

1. **Frais FBA fixes** : Estimation de 3€, peut varier selon le produit
2. **Commission Amazon** : Basée sur les données Keepa ou 15% par défaut
3. **Données Keepa** : Dépendent de la disponibilité sur chaque marketplace
4. **Recherche séquentielle** : Testée domaine par domaine (optimisé par priorité)

## 🔄 Évolutions Possibles

- Calcul dynamique des frais FBA selon les dimensions
- Intégration d'autres sources de données (MWS, SP-API)
- Ajout de marketplaces non-européens
- Optimisation parallèle des recherches multi-domaines
- Historique et tendances de ROI 