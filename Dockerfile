# Utiliser l'image officielle Node.js
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install --only=production

# Copier le code source
COPY . .

# Exposer le port 8080 (requis par Cloud Run)
EXPOSE 8080

# Définir la variable d'environnement pour le port
ENV PORT=8080

# Commande pour démarrer l'application
CMD ["npm", "start"]