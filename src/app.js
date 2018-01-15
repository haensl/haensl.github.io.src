const express = require('express');
const compression = require('compression');
const package = require('./package.json');
const app = express();
const port = process.env.PORT || 8080;

app.disable('x-powered-by');
app.use(compression());
app.use('/', express.static(`${__dirname}/`));

app.listen(port, () => {
  console.info(`${package.name} v${package.version} listening on ${port}`);
});
