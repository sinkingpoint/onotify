# Onotify

This is a prototype drop in replacement for Prometheus Alertmanager, built on top of Cloudflare Workers. This allows scaling pretty much infinitely, with built in HA, at a fraction of the cost of running multiple Alertmanager VMs.

## API

While entirely backwards compatible with Alertmanager (e.g. dashboards like [karma](https://github.com/prymitive/karma) work out of the box), the API makes several quality of life improvements such as introducing (optional) pagination on GET endpoints, and introducing QoL endpoints like the ability to get statistics about the alerts and silences in the system.

## Missing Features

- Mutes
- Inhibitions
- Receivers beyond Webhooks

## Development

1. Run `wrangler dev` to start a local instance of the API.
2. Open `http://localhost:8787/` in your browser to see the Swagger interface where you can try the endpoints.
3. Changes made in the `src/` folder will automatically trigger the server to reload, you only need to refresh the Swagger interface.
