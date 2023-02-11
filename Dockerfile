FROM node:latest

RUN mkdir -p /usr/src/megura
WORKDIR /usr/src/megura

COPY package*.json /usr/src/megura
RUN npm install

COPY . /usr/src/megura

CMD ["node", "."]