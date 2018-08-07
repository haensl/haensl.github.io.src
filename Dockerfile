FROM node:8.11.3-alpine
COPY --chown=node:node dist/hpdietz.com/ /var/www/
USER node
WORKDIR /var/www
ENV NODE_ENV production
ENV PORT 8081
RUN npm i --production
EXPOSE 8081
ENTRYPOINT ["npm"]
CMD ["start"]
