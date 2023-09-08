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

## Todo

- Detect if files are already downloaded and skip them (images with and without params)
- get [wiki-texts](https://ddos.odenwilusenz.ch/api.php?action=query&format=json&prop=revisions&titles=Hauptseite&formatversion=2&rvprop=content&rvslots=*)
