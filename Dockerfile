FROM node:alpine
COPY dist/ /var/www/
RUN ls -la /var/www
LABEL version="2.11.2"
WORKDIR /var/www
ENV NODE_ENV production
ENV PORT 8081
RUN npm i --production
EXPOSE 8081
ENTRYPOINT ["npm"]
CMD ["start"]
