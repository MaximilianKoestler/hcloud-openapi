# Unofficial OpenAPI Description for the Hetzner Cloud API

- [Link to the openAPI document](openapi/hcloud.json)
- [Official documentation](https://docs.hetzner.cloud/)

# Quick Start

```
ts-node src/index.ts -o openapi/hcloud.json
```

# Usage with OpenAPI Generator

- [Project on GitHub](https://github.com/OpenAPITools/openapi-generator)

## Validate

```
java -jar <path>/openapi-generator-cli.jar validate --input-spec openapi/hcloud.json
```

## Generate

```
java -jar <path>/openapi-generator-cli.jar generate --input-spec openapi/hcloud.json --generator-name <name> --output <path>
```
