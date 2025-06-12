#!/bin/bash

# Script de déploiement pour l'API SellerAmp ROI

echo "🚀 Démarrage du déploiement de l'API SellerAmp ROI..."

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "server.js" ]; then
    echo "❌ Erreur: server.js non trouvé. Êtes-vous dans le bon répertoire ?"
    exit 1
fi

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# Vérifier que le fichier .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Attention: Fichier .env non trouvé."
    echo "Créez le fichier .env avec vos credentials SellerAmp :"
    echo "SELLERAMP_EMAIL=votre_email@example.com"
    echo "SELLERAMP_PASSWORD=votre_mot_de_passe"
    echo "PORT=3000"
    read -p "Voulez-vous continuer quand même ? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install --production

# Arrêter l'application si elle tourne déjà
echo "🛑 Arrêt de l'ancienne version..."
pm2 stop selleramp-roi-api 2>/dev/null || echo "Aucune instance à arrêter"
pm2 delete selleramp-roi-api 2>/dev/null || echo "Aucune instance à supprimer"

# Démarrer l'application avec PM2
echo "🚀 Démarrage de l'application avec PM2..."
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2
echo "💾 Sauvegarde de la configuration PM2..."
pm2 save

# Activer le démarrage automatique
echo "🔄 Configuration du démarrage automatique..."
pm2 startup

echo "✅ Déploiement terminé !"
echo ""
echo "📊 Statut de l'application :"
pm2 status

echo ""
echo "🌐 L'API est maintenant accessible sur le port 3000"
echo "💡 Commandes utiles :"
echo "   pm2 status                 - Voir le statut"
echo "   pm2 logs selleramp-roi-api - Voir les logs"
echo "   pm2 restart selleramp-roi-api - Redémarrer"
echo "   pm2 stop selleramp-roi-api - Arrêter" 