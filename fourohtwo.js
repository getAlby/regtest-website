const path = require("path");
const express = require("express");
const nodeFetch = require("node-fetch");

class Lnd {
  constructor(config) {
    this.config = config;
  }

  getInfo() {
    return this.request("GET", "/v1/getinfo", undefined, {});
  }

  sendPayment(args) {
    return this.request("POST", "/v2/router/send", args, {}).then((res) => {
      console.log(res);
      return res.json();
    });
  }

  makeInvoice(args) {
    return this.request("POST", "/v1/invoices", {
      memo: args.memo,
      value: args.amount,
    });
  }

  getAddress() {
    return this.request("POST", "/v2/wallet/address/next", undefined, {});
  }

  getBlockchainBalance() {
    return this.request("GET", "/v1/balance/blockchain", undefined, {});
  }

  async request(method, path, args, defaultValues) {
    let body = null;
    let query = "";
    const headers = new nodeFetch.Headers();
    headers.append("Accept", "application/json");
    if (method === "POST") {
      body = JSON.stringify(args);
      headers.append("Content-Type", "application/json");
    } else if (args !== undefined) {
      query = `?`; //`?${stringify(args)}`;
    }
    if (this.config.macaroon) {
      headers.append("Grpc-Metadata-macaroon", this.config.macaroon);
    }
    try {
      const res = await nodeFetch(this.config.url + path + query, {
        method,
        headers,
        body,
      });
      if (!res.ok) {
        let errBody;
        try {
          errBody = await res.json();
          if (!errBody.error) {
            throw new Error();
          }
        } catch (err) {
          throw {
            statusText: res.statusText,
            status: res.status,
          };
        }
        console.log("errBody", errBody);
        throw errBody;
      }
      let data = await res.json();
      if (defaultValues) {
        data = Object.assign(Object.assign({}, defaultValues), data);
      }
      return { data };
    } catch (err) {
      console.error(`API error calling ${method} ${path}`, err);
      // Thrown errors must be JSON serializable, so include metadata if possible
      if (err.code || err.status || !err.message) {
        throw err;
      }
      throw err.message;
    }
  }
}

lnd = new Lnd({
  url: process.env.LND_URL,
  macaroon: process.env.LND_MACAROON,
});

lnd.getInfo().then(console.log);

const app = express();
app.get("/", async function (req, res) {
  const invoice = await lnd.makeInvoice({ amount: 100, memo: "a402" });
  res.render("index", { invoice: invoice.data });
});

app.post("/invoice", async function (req, res) {
  const invoice = await lnd.makeInvoice({ amount: 100, memo: "a402" });
  res.json({ payment_request: invoice.data.payment_request });
});

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const port = process.env.PORT || 3030;
console.log(`Running on ${port}`);
app.listen(port);
