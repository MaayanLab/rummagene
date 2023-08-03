FROM node
WORKDIR /app
ADD package.json .
ADD package-lock.json .
RUN npm i
ADD public .
ADD src .
RUN npm run build
CMD ["npm", "start"]