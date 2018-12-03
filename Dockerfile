FROM node:lts-alpine
COPY --chown=node:node dist/hpdietz.com/ /var/www/
USER node
WORKDIR /var/www
RUN npm i --production
ENTRYPOINT ["npm"]
CMD ["start"]
