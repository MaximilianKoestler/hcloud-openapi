# Unofficial OpenAPI Description for the Hetzner Cloud API

![](https://github.com/MaximilianKoestler/hcloud-openapi/workflows/CI%20Build%20and%20OpenAPI%20Spec%20Generation/badge.svg)

This is an attempt to improve Hetzner's own OpenAPI specification to make it usable in code generation.

When this project was started, Hetzner had not published their own OpenAPI specification for their cloud API, so I decided to build my own based on the HTML documentation on their website.
Luckily, Hetzner has actually published an [OpenAPI spec for their API](https://docs.hetzner.cloud/cloud.spec.json) in the meantime but I think this project still adds some value.

While Hetzner now appears to generate their documentation website from the OpenAPI spec, the spec is not very useful for automatic code generation.
This project aims to convert the official spec to an improved version with the following main features:

- Definition of common components that are reused throughout the schema
- Added pagination support
- API-friendly tag names
- Unique `operationId`s

As an added benefit, mainly from use of common components, the improved spec is much smaller (548 KiB vs 1.4 MiB) than the original.

## Further Reading

- [Link to the generated openAPI document](openapi/hcloud.json)
- [Official API documentation](https://docs.hetzner.cloud/)
- [OpenAPI spec document provided by Hetzner](https://docs.hetzner.cloud/cloud.spec.json)
- [OpenAPI standard](https://swagger.io/specification/)

## Use Cases
This API description is currently being used by the following projects:
- [hcloud-rust](https://github.com/HenningHolmDE/hcloud-rust)
  [![Crates.io](https://img.shields.io/crates/v/hcloud.svg)](https://crates.io/crates/hcloud)
  [![Documentation](https://docs.rs/hcloud/badge.svg)](https://docs.rs/hcloud/)

## Supported Endpoints
<table style="text-align: center">
  <tr height="80">
    <td>actions</td>
    <td>certificates</td>
    <td>datacenters</td>
  </tr>
  <tr height="80">
    <td>floating_ips</td>
    <td>images</td>
    <td>isos</td>
  </tr>
  <tr height="80">
    <td>load_balancer_types</td>
    <td>load_balancers</td>
    <td>locations</td>
  </tr>
  <tr height="80">
    <td>networks</td>
    <td>pricing</td>
    <td>server_types</td>
  </tr>
  <tr height="80">
    <td>servers</td>
    <td>ssh_keys</td>
    <td>volumes</td>
  </tr>
  <tr height="80">
    <td>firewalls</td>
    <td>placement_groups</td>
    <td>primary_ips</td>
  </tr>
</table>

```
/actions (GET)
/actions/{id} (GET)
/certificates (GET, POST)
/certificates/{id} (DELETE, GET, PUT)
/certificates/{id}/actions (GET)
/certificates/{id}/actions/{action_id} (GET)
/certificates/{id}/actions/retry (POST)
/certificates/actions (GET)
/certificates/actions/{id} (GET)
/datacenters (GET)
/datacenters/{id} (GET)
/firewalls (GET, POST)
/firewalls/{id} (DELETE, GET, PUT)
/firewalls/{id}/actions (GET)
/firewalls/{id}/actions/{action_id} (GET)
/firewalls/{id}/actions/apply_to_resources (POST)
/firewalls/{id}/actions/remove_from_resources (POST)
/firewalls/{id}/actions/set_rules (POST)
/firewalls/actions (GET)
/firewalls/actions/{id} (GET)
/floating_ips (GET, POST)
/floating_ips/{id} (DELETE, GET, PUT)
/floating_ips/{id}/actions (GET)
/floating_ips/{id}/actions/{action_id} (GET)
/floating_ips/{id}/actions/assign (POST)
/floating_ips/{id}/actions/change_dns_ptr (POST)
/floating_ips/{id}/actions/change_protection (POST)
/floating_ips/{id}/actions/unassign (POST)
/floating_ips/actions (GET)
/floating_ips/actions/{id} (GET)
/images (GET)
/images/{id} (DELETE, GET, PUT)
/images/{id}/actions (GET)
/images/{id}/actions/{action_id} (GET)
/images/{id}/actions/change_protection (POST)
/images/actions (GET)
/images/actions/{id} (GET)
/isos (GET)
/isos/{id} (GET)
/load_balancer_types (GET)
/load_balancer_types/{id} (GET)
/load_balancers (GET, POST)
/load_balancers/{id} (DELETE, GET, PUT)
/load_balancers/{id}/actions (GET)
/load_balancers/{id}/actions/{action_id} (GET)
/load_balancers/{id}/actions/add_service (POST)
/load_balancers/{id}/actions/add_target (POST)
/load_balancers/{id}/actions/attach_to_network (POST)
/load_balancers/{id}/actions/change_algorithm (POST)
/load_balancers/{id}/actions/change_dns_ptr (POST)
/load_balancers/{id}/actions/change_protection (POST)
/load_balancers/{id}/actions/change_type (POST)
/load_balancers/{id}/actions/delete_service (POST)
/load_balancers/{id}/actions/detach_from_network (POST)
/load_balancers/{id}/actions/disable_public_interface (POST)
/load_balancers/{id}/actions/enable_public_interface (POST)
/load_balancers/{id}/actions/remove_target (POST)
/load_balancers/{id}/actions/update_service (POST)
/load_balancers/{id}/metrics (GET)
/load_balancers/actions (GET)
/load_balancers/actions/{id} (GET)
/locations (GET)
/locations/{id} (GET)
/networks (GET, POST)
/networks/{id} (DELETE, GET, PUT)
/networks/{id}/actions (GET)
/networks/{id}/actions/{action_id} (GET)
/networks/{id}/actions/add_route (POST)
/networks/{id}/actions/add_subnet (POST)
/networks/{id}/actions/change_ip_range (POST)
/networks/{id}/actions/change_protection (POST)
/networks/{id}/actions/delete_route (POST)
/networks/{id}/actions/delete_subnet (POST)
/networks/actions (GET)
/networks/actions/{id} (GET)
/placement_groups (GET, POST)
/placement_groups/{id} (DELETE, GET, PUT)
/pricing (GET)
/primary_ips (GET, POST)
/primary_ips/{id} (DELETE, GET, PUT)
/primary_ips/{id}/actions/assign (POST)
/primary_ips/{id}/actions/change_dns_ptr (POST)
/primary_ips/{id}/actions/change_protection (POST)
/primary_ips/{id}/actions/unassign (POST)
/primary_ips/actions (GET)
/primary_ips/actions/{id} (GET)
/server_types (GET)
/server_types/{id} (GET)
/servers (GET, POST)
/servers/{id} (DELETE, GET, PUT)
/servers/{id}/actions (GET)
/servers/{id}/actions/{action_id} (GET)
/servers/{id}/actions/add_to_placement_group (POST)
/servers/{id}/actions/attach_iso (POST)
/servers/{id}/actions/attach_to_network (POST)
/servers/{id}/actions/change_alias_ips (POST)
/servers/{id}/actions/change_dns_ptr (POST)
/servers/{id}/actions/change_protection (POST)
/servers/{id}/actions/change_type (POST)
/servers/{id}/actions/create_image (POST)
/servers/{id}/actions/detach_from_network (POST)
/servers/{id}/actions/detach_iso (POST)
/servers/{id}/actions/disable_backup (POST)
/servers/{id}/actions/disable_rescue (POST)
/servers/{id}/actions/enable_backup (POST)
/servers/{id}/actions/enable_rescue (POST)
/servers/{id}/actions/poweroff (POST)
/servers/{id}/actions/poweron (POST)
/servers/{id}/actions/reboot (POST)
/servers/{id}/actions/rebuild (POST)
/servers/{id}/actions/remove_from_placement_group (POST)
/servers/{id}/actions/request_console (POST)
/servers/{id}/actions/reset (POST)
/servers/{id}/actions/reset_password (POST)
/servers/{id}/actions/shutdown (POST)
/servers/{id}/metrics (GET)
/servers/actions (GET)
/servers/actions/{id} (GET)
/ssh_keys (GET, POST)
/ssh_keys/{id} (DELETE, GET, PUT)
/volumes (GET, POST)
/volumes/{id} (DELETE, GET, PUT)
/volumes/{id}/actions (GET)
/volumes/{id}/actions/{action_id} (GET)
/volumes/{id}/actions/attach (POST)
/volumes/{id}/actions/change_protection (POST)
/volumes/{id}/actions/detach (POST)
/volumes/{id}/actions/resize (POST)
/volumes/actions (GET)
/volumes/actions/{id} (GET)
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
