# Multi-stage build pentru Frontend React + Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copiază fișierele de dependențe
COPY package*.json ./

# Instalează dependențe
RUN npm ci

# Copiază codul sursă
COPY . .

# Build pentru producție
RUN npm run build

# Stage pentru producție - Nginx
FROM nginx:alpine AS production

# Copiază build-ul din stage-ul builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiază configurația Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expune portul
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
