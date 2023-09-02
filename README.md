# scrape-helpers

Some helper-functions to scrape websites

```sh
mkdir packages
git submodule add git@github.com:signalwerk/scrape-helpers.git "./packages/scrape-helpers"
cp packages/scrape-helpers/example.js get.js
cp packages/scrape-helpers/package.json .
mkdir DATA
npm i
echo "/node_modules" >> .gitignore
```
