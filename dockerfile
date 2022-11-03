FROM node:17-alpine
COPY ./ /app/
WORKDIR /app
RUN npm install
EXPOSE 3001
CMD node app.js