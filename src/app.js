const express = require('express');
const compression = require('compression');
const package = require('./package.json');
const app = express();
const port = process.env.port || 8080;

app.use(compression());
app.use('/', express.static(`${__dirname}/`));
app.listen(port, () => {
  console.info(`${package.name} listening on ${port}`);
});
