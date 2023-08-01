FROM node
ADD package.json .
ADD package-lock.json .
RUN npm i
ADD postgraphile.js .
ENV NODE_ENV=production
CMD [ "npm", "start" ]