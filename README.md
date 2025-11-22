# Unofficial OpenAPI Description for the Hetzner Cloud API

![](https://github.com/MaximilianKoestler/hcloud-openapi/workflows/CI%20Build%20and%20OpenAPI%20Spec%20Generation/badge.svg)

This is an attempt to improve Hetzner's own OpenAPI specification to make it usable in code generation.

When this project was started, Hetzner had not published their own OpenAPI specification for their cloud API, so I decided to build my own based on the HTML documentation on their website.
By now, Hetzner has actually published an [OpenAPI spec for their Cloud API](https://docs.hetzner.cloud/cloud.spec.json) and recently also [the Hetzner API](https://docs.hetzner.cloud/hetzner.spec.json) However, I think this project still adds some value.

While Hetzner now appears to generate their documentation website from the OpenAPI spec, the spec is not very useful for automatic code generation.
This project aims to convert the official specs to an improved version with the following main features:

- A single file describing all API endpoints from multiple source documents
- Definition of common components that are reused throughout the schema
- API-friendly tag names
- Unique `operationId`s

As an added benefit, mainly from use of common components, the improved spec is much smaller (945 KB vs 2.291 MB) than the original.

## Further Reading

- [Link to the generated openAPI document](openapi/hcloud.json)
- [Official API documentation](https://docs.hetzner.cloud/)
- [OpenAPI spec document provided by Hetzner for the Hetzner Cloud API](https://docs.hetzner.cloud/cloud.spec.json)
- [OpenAPI spec document provided by Hetzner for the Hetzner API](https://docs.hetzner.cloud/hetzner.spec.json)
- [OpenAPI standard](https://swagger.io/specification/)

## Use Cases

This API description is currently being used by the following projects:

- [hcloud-rust](https://github.com/HenningHolmDE/hcloud-rust)
  [![Crates.io](https://img.shields.io/crates/v/hcloud.svg)](https://crates.io/crates/hcloud)
  [![Documentation](https://docs.rs/hcloud/badge.svg)](https://docs.rs/hcloud/)

## Supported Endpoints

- actions
- certificates
- datacenters
- firewalls
- floating_ips
- images
- isos
- load_balancer_types
- load_balancers
- locations
- networks
- placement_groups
- pricing
- primary_ips
- server_types
- servers
- ssh_keys
- storage_box_types
- storage_boxes
- volumes
- zones

```
# Main hcloud API

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
/zones (GET, POST)
/zones/actions (GET)
/zones/actions/{id} (GET)
/zones/{id_or_name} (DELETE, GET, PUT)
/zones/{id_or_name}/actions (GET)
/zones/{id_or_name}/actions/change_primary_nameservers (POST)
/zones/{id_or_name}/actions/change_protection (POST)
/zones/{id_or_name}/actions/change_ttl (POST)
/zones/{id_or_name}/actions/import_zonefile (POST)
/zones/{id_or_name}/actions/{action_id} (GET)
/zones/{id_or_name}/rrsets (GET, POST)
/zones/{id_or_name}/rrsets/{rr_name}/{rr_type} (DELETE, GET, PUT)
/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/add_records (POST)
/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/change_protection (POST)
/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/change_ttl (POST)
/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/remove_records (POST)
/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/set_records (POST)
/zones/{id_or_name}/rrsets/{rr_name}/{rr_type}/actions/update_records (POST)
/zones/{id_or_name}/zonefile (GET)

# Storage Boxes

/storage_box_types (GET)
/storage_box_types/{id} (GET)
/storage_boxes (GET, POST)
/storage_boxes/actions (GET)
/storage_boxes/actions/{id} (GET)
/storage_boxes/{id} (DELETE, GET, PUT)
/storage_boxes/{id}/actions (GET)
/storage_boxes/{id}/actions/change_protection (POST)
/storage_boxes/{id}/actions/change_type (POST)
/storage_boxes/{id}/actions/disable_snapshot_plan (POST)
/storage_boxes/{id}/actions/enable_snapshot_plan (POST)
/storage_boxes/{id}/actions/reset_password (POST)
/storage_boxes/{id}/actions/rollback_snapshot (POST)
/storage_boxes/{id}/actions/update_access_settings (POST)
/storage_boxes/{id}/actions/{action_id} (GET)
/storage_boxes/{id}/folders (GET)
/storage_boxes/{id}/snapshots (GET, POST)
/storage_boxes/{id}/snapshots/{snapshot_id} (DELETE, GET, PUT)
/storage_boxes/{id}/subaccounts (GET, POST)
/storage_boxes/{id}/subaccounts/{subaccount_id} (DELETE, GET, PUT)
/storage_boxes/{id}/subaccounts/{subaccount_id}/actions/change_home_directory (POST)
/storage_boxes/{id}/subaccounts/{subaccount_id}/actions/reset_subaccount_password (POST)
/storage_boxes/{id}/subaccounts/{subaccount_id}/actions/update_access_settings (POST)
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
