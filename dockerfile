FROM node:20-alpine
COPY ./ /app/
WORKDIR /app
RUN npm ci --omit=dev
EXPOSE 3001
CMD ["node", "app.js"]