FROM node
WORKDIR /app
ADD package.json .
ADD package-lock.json .
RUN npm i
ADD . .
RUN npm run build && rm .env
CMD ["npm", "start"]