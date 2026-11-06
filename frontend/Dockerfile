FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:conauti

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY --from=build /app/dist-conauti /usr/share/nginx/html
COPY nginx.conauti.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
