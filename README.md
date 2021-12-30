# Alby Payground


### Installation

#### Configuration

Simply configure your macaroon HEX string (e.g. from [Polar](https://lightningpolar.com/)) and the REST API address in a `.env` file. See `.env.example`. 

```bash
$ git clone https://github.com/getAlby/regtest-website.git
$ cd regtest-website
$ yarn install
$ cp .env.example .env
# edit .env and set a `LND_URL` and `LND_MACAROON_HEX` environment variable
$ node fourohtwo.js
$ open http://localhost:3030
```

