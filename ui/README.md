# onotify UI

This is the root of the UI for onotify, built using preact and tailwind. See the top level of this repo for how to build/deploy the UI.

## Structure

### components/

This contains the components that onotify uses in its UI. For the most part, these are custom - we don't use UI libraries for a couple of reasons: a) This allows us to more precisely control the components (especially to meet accessibility requirements) and b) to control bloat

### pages/

This contains the underlying pages that make up onotify. Add new folders here if you have new main views.

### pkg/api/

This contains the generated client libraries that the UI uses to communicate to the backend.

## Re-generating the client libraries

If you introduce new API endpoints, or modify the contracts of existing ones then you'll need to re-generate the client libraries before you can use them in the UI. To do this (assuming the dev server is running):

```
curl http://localhost:8787/openapi.json | jq > src/pkg/api/openapi.json
npm run generate
```
