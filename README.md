# Onotify

This is a prototype drop in replacement for Prometheus Alertmanager, built on top of Cloudflare Workers. This allows scaling pretty much infinitely, with built in HA, at a fraction of the cost of running multiple Alertmanager VMs.

## API

While entirely backwards compatible with Alertmanager (e.g. dashboards like [karma](https://github.com/prymitive/karma) work out of the box), the API makes several quality of life improvements such as introducing (optional) pagination on GET endpoints, and introducing QoL endpoints like the ability to get statistics about the alerts and silences in the system.

## Missing Features

- Mutes
- Inhibitions
- Receivers beyond Webhooks

## Development

1. Copy the dev vars: `cp ./.dev.vars.placeholder ./.dev.vars`
2. Create the dev db: `npx wrangler d1 execute onotify --file ./sql/0001-create-db.sql`
3. Run `wrangler dev` to start a local instance of the API.
4. Open `http://localhost:8787/` in your browser to see the Swagger interface where you can try the endpoints.
5. Changes made in the `src/` folder will automatically trigger the server to reload, you only need to refresh the Swagger interface.

## Karma

Karma is a useful UI for alertmanager, and onotify supports it out of the box. With a config such as:

```
listen:
  port: 9090
alertmanager:
  servers:
    - name: onotify
      uri: http://localhost:8787
      proxy: true
      headers:
        authorization: "Bearer notify-test"
```

You can start karma with:

```
docker run -d --net host -e CONFIG_FILE="/karma.conf" --name karma -v $(PWD)karma.conf:/karma.conf ghcr.io/prymitive/karma:latest
```

## Prometheus

You can configure Onotify as an Alertmanager in your Prometheus config with:

```
alerting:
  alertmanagers:
    - scheme: http
      authorization:
        credentials: notify-test
      static_configs:
        - targets:
            - localhost:8787
```
