# Multi-stage build pentru Backend Laravel
FROM php:8.2-fpm-alpine AS base

# Instalează dependențe sistem și extensii PHP
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libzip-dev \
    zip \
    unzip \
    oniguruma-dev \
    postgresql-dev \
    mysql-client \
    nodejs \
    npm

# Instalează extensii PHP
RUN docker-php-ext-install \
    pdo \
    pdo_mysql \
    pdo_pgsql \
    mbstring \
    exif \
    pcntl \
    bcmath \
    gd \
    zip \
    opcache

# Instalează Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Setează working directory
WORKDIR /var/www/html

# Copiază fișierele aplicației
COPY . .

# Instalează dependențe PHP
RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Instalează dependențe Node.js și build assets
RUN npm install && npm run build

# Setează permisiuni
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

# Stage pentru producție
FROM php:8.2-fpm-alpine AS production

# Instalează dependențe minime pentru runtime
RUN apk add --no-cache \
    libpng \
    libzip \
    oniguruma \
    postgresql-libs \
    mysql-client

# Instalează extensii PHP
RUN docker-php-ext-install \
    pdo \
    pdo_mysql \
    pdo_pgsql \
    mbstring \
    exif \
    pcntl \
    bcmath \
    gd \
    zip \
    opcache

# Configurare OPcache pentru producție
RUN echo "opcache.enable=1" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.memory_consumption=128" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.interned_strings_buffer=8" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.max_accelerated_files=10000" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.validate_timestamps=0" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.save_comments=1" >> /usr/local/etc/php/conf.d/opcache.ini

WORKDIR /var/www/html

# Copiază aplicația din stage-ul base
COPY --from=base --chown=www-data:www-data /var/www/html /var/www/html

# Setează permisiuni
RUN chmod -R 775 /var/www/html/storage \
    && chmod -R 775 /var/www/html/bootstrap/cache

# Expune portul PHP-FPM
EXPOSE 9000

# Entrypoint script pentru inițializare
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php-fpm"]
