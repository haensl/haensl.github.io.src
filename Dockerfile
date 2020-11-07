FROM node:lts-alpine
COPY --chown=node:node dist/hpdietz.com/ /var/www/
USER node
WORKDIR /var/www
ENV NODE_ENV=production
RUN npm ci
ENTRYPOINT ["npm"]
CMD ["start"]
