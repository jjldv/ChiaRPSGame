module.exports = {
    apps: [{
      name: "chiarps",
      script: "uvicorn",
      args: "app:app --host 0.0.0.0 --port 443 --ssl-certfile /etc/letsencrypt/live/chiarps.mrdennis.dev/fullchain.pem --ssl-keyfile /etc/letsencrypt/live/chiarps.mrdennis.dev/privkey.pem",
      interpreter: "./venv/bin/python3",
      env: {
        PATH: "./venv/bin:$PATH"
      }
    }]
  }