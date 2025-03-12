# scrape-helpers

Some helper-functions to scrape websites

```sh
mkdir packages
git submodule add git@github.com:signalwerk/scrape-helpers.git "./packages/scrape-helpers"
mkdir src
cp packages/scrape-helpers/example/src/index.js ./src/index.js
cp packages/scrape-helpers/example/package.json .
mkdir DATA
npm i
echo "/node_modules" >> .gitignore
```

## Run

```sh
npm run dev
open http://localhost:3035/
```

## Todo

- get [wiki-texts](https://ddos.odenwilusenz.ch/api.php?action=query&format=json&prop=revisions&titles=Hauptseite&formatversion=2&rvprop=content&rvslots=*)
