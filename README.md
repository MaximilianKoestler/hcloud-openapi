# Unofficial OpenAPI Description for the Hetzner Cloud API

![](https://github.com/MaximilianKoestler/hcloud-openapi/workflows/CI%20Build%20and%20OpenAPI%20Spec%20Generation/badge.svg)

- [Link to the openAPI document](openapi/hcloud.json)
- [Official API documentation](https://docs.hetzner.cloud/)

This repository contains scripts to generate an [OpenAPI](https://swagger.io/specification/) description of the [Hetzner Cloud API](https://docs.hetzner.cloud/).

## Use Cases
This API description is currently being used by the following projects:
- [hcloud-rust](https://github.com/HenningHolmDE/hcloud-rust)
  [![Crates.io](https://img.shields.io/crates/v/hcloud.svg)](https://crates.io/crates/hcloud)
  [![Documentation](https://docs.rs/hcloud/badge.svg)](https://docs.rs/hcloud/)

## Quick Start

```
npm run convert -- --output results/hcloud.json
```

## Usage with OpenAPI Generator

[OpenAPI Generator on GitHub](https://github.com/OpenAPITools/openapi-generator)

### Validate

```
java -jar <path>/openapi-generator-cli.jar validate --input-spec openapi/hcloud.json
```

### Generate

```
java -jar <path>/openapi-generator-cli.jar generate --input-spec openapi/hcloud.json --generator-name <name> --output <path>
```
