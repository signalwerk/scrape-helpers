# scrape-helpers

Some helper-functions to scrape websites

```sh
mkdir packages
git submodule add git@github.com:signalwerk/scrape-helpers.git "./packages/scrape-helpers"
cp packages/scrape-helpers/example.js get.js
mkdir DATA
npm init -y
npm i axios cheerio cli-progress
echo "/node_modules" >> .gitignore

jq '.type = "module"' package.json | sponge package.json
jq '.scripts.dl = "node get.js --dl"' package.json | sponge package.json
jq '.scripts.clear = "node get.js --clear"' package.json | sponge package.json
```
