FROM node:alpine
COPY --chown=node:node dist/hpdietz.com/ /var/www/
LABEL version="2.16.1"
WORKDIR /var/www
ENV NODE_ENV production
ENV PORT 8081
RUN npm i --production
EXPOSE 8081
ENTRYPOINT ["npm"]
CMD ["start"]
