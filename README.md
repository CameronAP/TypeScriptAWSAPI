# TypeScriptAWSAPI

A small API for creating, retrieving, updating, and deleting location records. When a location record is created or a records location data is updated, its latitude and longitude is retrieved using the OpenStreetMap(OSM) API and stored alongside the record.

## AI Disclaimer

AI was used only to assist with searching documentation and debugging. No AI integration was used to create the project, and any AI usage was limited to online chatbots.

## Requirements

- Node.js 22+ (required by `openapi-ts`)
- AWS CLI installed and configured
- A bootstrapped AWS account

## Setup

1. Install dependencies for both the API and base packages:
   ```bash
   npm run install:all
   ```

2. Generate TypeScript types from `openapi.yaml` (used by the Lambdas):
   ```bash
   npm run genApi:types
   ```

3. Generate documentation from `openapi.yaml`:
   ```bash
   npm run genApi:docs
   ```
   This creates an OpenAPI spec at `src/stacks/api/docs` to help navigate the API.
## Deploy
 
Deploys the database and API:
 
```bash
npm run deploy -- -c prefix=<stack_prefix>
```
 
## Testing
 
Run jest testing setup for the API module:
 
```bash
npm run test
```
 
### Manual Testing
 
See `testRequests.http` for a list of example requests. In VS Code, you can use the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension to send requests directly from the file.

## Linting
 
Run the linter with:
 
```bash
npm run lint
```

## Future Improvements / Production Considerations
   
The time limit for the tech task doesnt allow for a full production implementation of this service. When productionizing the service I would improve/implement the following:

- **Networking and security** - Everything should sit inside a private VPC, with the database placed in a private, isolated subnet. Only the API Lambdas would be granted access via a VPC endpoint.

- **More precise location lookups** - OpenStreetMap (OSM) has limitations in how it calculates administrative boundaries and categorises locations, which makes it difficult to use UK county names to find locations. For example searching for "Swindon, Wiltshire, United Kingdom" or "Newport, Shropshire, United Kingdom" does not return an accurate location within the town itself. In future, this could be resolved by combining OSM with Overpass to determine a more accurate location, or by requiring the user to provide a more precise identifier, such as a postcode.

- **Centralise database access** - Refactor all DB-related functions into a shared service to centralise and standardise interactions and reduce code duplication

- **Input validation with Zod** - Use [Zod](https://zod.dev/) to validate inputs at the API boundary.

- **Stateful resource safety checks** - Add unit tests asserting on the logical IDs of stateful resources (in this case the Locations Table) when using production prefixes. These would be used as another check that any new version deployed to production wont orphan or accidentally recreate any stateful resource causing data loss.

- **Smoke / integration testing** - Set up smoke and integration tests that run against a deployed API, rather than testing in isolation only.

- **Static API endpoint** - Use a static, custom domain for the API (e.g. via Route 53) instead of the default auto-generated API Gateway URL, which changes with every new deployment/stack.
- **API Gateway default Responses** - Customise the default API Gateway responses such as 403 Forbidden to match the format of the reponses produced by the lambdas