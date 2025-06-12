# API SellerAmp ROI

Une API REST qui utilise Puppeteer pour automatiser le calcul du ROI via SellerAmp.

## Installation

1. Clonez le repository
2. Installez les dépendances :
```bash
npm install
```

3. Créez un fichier `.env` à la racine du projet avec vos credentials SellerAmp :
```env
# Credentials pour SellerAmp
SELLERAMP_EMAIL=votre_email@example.com
SELLERAMP_PASSWORD=votre_mot_de_passe

# Configuration serveur
PORT=3000
```

## Utilisation

### Démarrer le serveur
```bash
npm start
```

Le serveur se lance par défaut sur le port 3000.

### Interface web
Une interface web est disponible à l'adresse : http://localhost:3000

Cette interface permet de :
- Tester l'API directement depuis le navigateur
- Saisir un code produit et un prix
- Visualiser le résultat du calcul ROI
- Gérer les erreurs de manière conviviale

### Endpoints disponibles

#### Health Check
```
GET /api/health
```

Retourne le statut de l'API.

**Réponse :**
```json
{
  "status": "OK",
  "message": "API SellerAmp ROI fonctionne correctement",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### Calculer le ROI
```
POST /api/roi
```

Calcule le ROI pour un code produit et un prix donnés.

**Body (JSON) :**
```json
{
  "code": "0020714146559",
  "prix": 25.99
}
```

**Réponse en cas de succès :**
```json
{
  "success": true,
  "code": "0020714146559",
  "prix": 25.99,
  "roi": "- 125.58%"
}
```

**Réponse en cas d'erreur :**
```json
{
  "erreur": "Erreur lors du calcul du ROI",
  "message": "Description de l'erreur"
}
```

### Exemple d'utilisation avec curl

```bash
# Test de santé
curl http://localhost:3000/api/health

# Calcul du ROI
curl -X POST http://localhost:3000/api/roi \
  -H "Content-Type: application/json" \
  -d '{"code": "0020714146559", "prix": 25.99}'
```

## Fonctionnement

L'API utilise Puppeteer pour :

1. Se connecter automatiquement à SellerAmp avec vos credentials
2. Rechercher le produit avec le code fourni
3. Saisir le prix spécifié
4. Récupérer le ROI calculé
5. Retourner le résultat via l'API REST

## Configuration

- `SELLERAMP_EMAIL` : Votre email SellerAmp
- `SELLERAMP_PASSWORD` : Votre mot de passe SellerAmp  
- `PORT` : Port du serveur (défaut: 3000)

## Dépendances

- **express** : Serveur web
- **puppeteer** : Automatisation du navigateur
- **dotenv** : Gestion des variables d'environnement 