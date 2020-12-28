# Unofficial OpenAPI Description for the Hetzner Cloud API

![](https://github.com/MaximilianKoestler/hcloud-openapi/workflows/CI%20Build%20and%20OpenAPI%20Spec%20Generation/badge.svg)

This is an attempt to improve Hetzner's own OpenAPI specification to make it usable in code generation.
When this project was started, Hetzner had not published their own OpenAPI specification for their cloud API, so I decided to build my own based on the HTML documentation on their website.
Luckily, Hetzner has actually published an [OpenAPI spec for their API](https://docs.hetzner.cloud/spec.json) in the meantime but I think this project still adds some value.
While Hetzner now appears to generate their documentation website from the OpenAPI spec, the spec is not very useful for automatic code generation.
This project aims to convert the official spec to an improved version with the following main features:

- Definition of common components that are reused throughout the schema
- Added pagination support
- API-friendly tag names
- Unique `operationId`s

As an added benefit, mainly from use of common components, the improved spec much smaller (414 KiB vs 1 MiB) than the original.

## Further Reading

- [Link to the generated openAPI document](openapi/hcloud.json)
- [Official API documentation](https://docs.hetzner.cloud/)
- [OpenAPI spec document provided by Hetzner](https://docs.hetzner.cloud/spec.json)
- [OpenAPI standard](https://swagger.io/specification/)

## Use Cases
This API description is currently being used by the following projects:
- [hcloud-rust](https://github.com/HenningHolmDE/hcloud-rust)
  [![Crates.io](https://img.shields.io/crates/v/hcloud.svg)](https://crates.io/crates/hcloud)
  [![Documentation](https://docs.rs/hcloud/badge.svg)](https://docs.rs/hcloud/)

## Supported Endpoints
<table style="text-align: center">
  <tr height="80">
    <td style="background-color:#f44336">actions</td>
    <td style="background-color:#E91E63">certificates</td>
    <td style="background-color:#9C27B0">datacenters</td>
  </tr>
  <tr height="80">
    <td style="background-color:#673AB7">floating_ips</td>
    <td style="background-color:#3F51B5">images</td>
    <td style="background-color:#2196F3">isos</td>
  </tr>
  <tr height="80">
    <td style="background-color:#03A9F4">load_balancer_types</td>
    <td style="background-color:#00BCD4">load_balancers</td>
    <td style="background-color:#009688">locations</td>
  </tr>
  <tr height="80">
    <td style="background-color:#4CAF50">networks</td>
    <td style="background-color:#8BC34A">pricing</td>
    <td style="background-color:#CDDC39">server_types</td>
  </tr>
  <tr height="80">
    <td style="background-color:#FFEB3B">servers</td>
    <td style="background-color:#FFC107">ssh_keys</td>
    <td style="background-color:#FF9800">volumes</td>
  </tr>
</table>

```
/actions (GET)
/actions/{id} (GET)
/certificates (GET, POST)
/certificates/{id} (GET, PUT, DELETE)
/datacenters (GET)
/datacenters/{id} (GET)
/floating_ips (GET, POST)
/floating_ips/{id} (GET, PUT, DELETE)
/floating_ips/{id}/actions (GET)
/floating_ips/{id}/actions/{action_id} (GET)
/floating_ips/{id}/actions/assign (POST)
/floating_ips/{id}/actions/unassign (POST)
/floating_ips/{id}/actions/change_dns_ptr (POST)
/floating_ips/{id}/actions/change_protection (POST)
/images (GET)
/images/{id} (GET, PUT, DELETE)
/images/{id}/actions (GET)
/images/{id}/actions/{action_id} (GET)
/images/{id}/actions/change_protection (POST)
/isos (GET)
/isos/{id} (GET)
/load_balancers (GET, POST)
/load_balancers/{id} (GET, PUT, DELETE)
/load_balancers/{id}/metrics (GET)
/load_balancers/{id}/actions (GET)
/load_balancers/{id}/actions/{action_id} (GET)
/load_balancers/{id}/actions/add_service (POST)
/load_balancers/{id}/actions/update_service (POST)
/load_balancers/{id}/actions/delete_service (POST)
/load_balancers/{id}/actions/add_target (POST)
/load_balancers/{id}/actions/remove_target (POST)
/load_balancers/{id}/actions/change_algorithm (POST)
/load_balancers/{id}/actions/change_type (POST)
/load_balancers/{id}/actions/attach_to_network (POST)
/load_balancers/{id}/actions/detach_from_network (POST)
/load_balancers/{id}/actions/enable_public_interface (POST)
/load_balancers/{id}/actions/disable_public_interface (POST)
/load_balancers/{id}/actions/change_protection (POST)
/load_balancer_types (GET)
/load_balancer_types/{id} (GET)
/locations (GET)
/locations/{id} (GET)
/networks (GET, POST)
/networks/{id} (GET, PUT, DELETE)
/networks/{id}/actions (GET)
/networks/{id}/actions/{action_id} (GET)
/networks/{id}/actions/add_subnet (POST)
/networks/{id}/actions/delete_subnet (POST)
/networks/{id}/actions/add_route (POST)
/networks/{id}/actions/delete_route (POST)
/networks/{id}/actions/change_ip_range (POST)
/networks/{id}/actions/change_protection (POST)
/pricing (GET)
/servers (GET, POST)
/servers/{id} (GET, PUT, DELETE)
/servers/{id}/metrics (GET)
/servers/{id}/actions (GET)
/servers/{id}/actions/{action_id} (GET)
/servers/{id}/actions/poweron (POST)
/servers/{id}/actions/reboot (POST)
/servers/{id}/actions/reset (POST)
/servers/{id}/actions/shutdown (POST)
/servers/{id}/actions/poweroff (POST)
/servers/{id}/actions/reset_password (POST)
/servers/{id}/actions/enable_rescue (POST)
/servers/{id}/actions/disable_rescue (POST)
/servers/{id}/actions/create_image (POST)
/servers/{id}/actions/rebuild (POST)
/servers/{id}/actions/change_type (POST)
/servers/{id}/actions/enable_backup (POST)
/servers/{id}/actions/disable_backup (POST)
/servers/{id}/actions/attach_iso (POST)
/servers/{id}/actions/detach_iso (POST)
/servers/{id}/actions/change_dns_ptr (POST)
/servers/{id}/actions/change_protection (POST)
/servers/{id}/actions/request_console (POST)
/servers/{id}/actions/attach_to_network (POST)
/servers/{id}/actions/detach_from_network (POST)
/servers/{id}/actions/change_alias_ips (POST)
/server_types (GET)
/server_types/{id} (GET)
/ssh_keys (GET, POST)
/ssh_keys/{id} (GET, PUT, DELETE)
/volumes (GET, POST)
/volumes/{id} (GET, PUT, DELETE)
/volumes/{id}/actions (GET)
/volumes/{id}/actions/{action_id} (GET)
/volumes/{id}/actions/attach (POST)
/volumes/{id}/actions/detach (POST)
/volumes/{id}/actions/resize (POST)
/volumes/{id}/actions/change_protection (POST)
```

## Quick Start

```
npm run convert -- --output openapi/hcloud.json
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
