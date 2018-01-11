FROM node:alpine
COPY dist/* /var/www
WORKDIR /var/www
ENV NODE_ENV production
ENV PORT 8081
RUN npm i
EXPOSE 8081
ENTRYPOINT ["npm"]
CMD ["start"]
