FROM node:12

WORKDIR ./

COPY ./package.json .
RUN npm cache clean --force
RUN npm install
COPY . .

EXPOSE 8080
EXPOSE 8070
EXPOSE 8060
EXPOSE 8050

# CMD npm start
CMD [ "node", "main.js" ]

