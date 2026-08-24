import { deduplicateSchemas } from "./deduplicate";
import { CommonComponent } from "./deduplicate";

describe("deduplicateSchemas", () => {
  it("should process a simple schema without errors without commonComponents", () => {
    // schemas must be an object representing an OpenApiDocumentFragment
    const schemas: any = {
      TestSchema1: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
        },
      },
      TestSchema2: {
        type: "object",
        properties: {
          id: { type: "integer" },
          description: { type: "string" },
        },
      },
    };

    const result = deduplicateSchemas(schemas, undefined);

    // It should return the components that were extracted (which are TestSchema components)
    expect(result).toBeDefined();
    expect(result.length).toBe(0);
  });

  it("should process a schema using provided commonComponents", () => {
    const schemas: any = {
      TestSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
        },
      },
    };

    const mockCommonComponents: CommonComponent[] = [
      {
        name: "TestComponent",
        path: ["TestSchema", "properties", "id"],
        description: "A test component",
      },
    ];

    const result = deduplicateSchemas(schemas, mockCommonComponents);
    expect(result).toBeDefined();
  });

  it("should extract a complex shared sub-object as a component without commonComponents", () => {
    const schemas: any = {
      Root1: {
        type: "object",
        properties: {
          shared_sub_object: {
            type: "object",
            properties: {
              propA: { type: "string" },
              propB: { type: "integer" },
            },
          },
        },
      },
      Root2: {
        type: "object",
        properties: {
          shared_sub_object: {
            type: "object",
            properties: {
              propA: { type: "string" },
              propB: { type: "integer" },
            },
          },
        },
      },
    };

    const result = deduplicateSchemas(schemas, undefined);

    // After deduplication, the schema should contain the extracted component.
    const componentName = "shared_sub_object";
    expect(schemas[componentName]).toBeDefined();
    expect(schemas[componentName].properties).toBeDefined();
    expect(schemas[componentName].properties.propA.type).toBe("string");

    // The original locations should now be references to the component
    expect(schemas.Root1.properties.shared_sub_object.$ref).toBe(
      `#/components/schemas/${componentName}`
    );
    expect(schemas.Root2.properties.shared_sub_object.$ref).toBe(
      `#/components/schemas/${componentName}`
    );

    // Verify the result array has the extracted component
    expect(result.some((c) => c.name === componentName)).toBe(true);
  });

  it("should apply an extracted component using provided commonComponents", () => {
    const schemas: any = {
      Root1: {
        type: "object",
        properties: {
          shared_sub_object: {
            type: "object",
            properties: {
              propA: { type: "string" },
              propB: { type: "integer" },
            },
          },
        },
      },
      Root2: {
        type: "object",
        properties: {
          shared_sub_object: {
            type: "object",
            properties: {
              propA: { type: "string" },
              propB: { type: "integer" },
            },
          },
        },
      },
    };

    const mockCommonComponents: CommonComponent[] = [
      {
        name: "MyCustomComponent",
        path: ["Root1", "shared_sub_object"],
        description: "A customized component description",
      },
    ];

    const result = deduplicateSchemas(schemas, mockCommonComponents);

    // Check that it used the customized name from the input array
    expect(schemas.MyCustomComponent).toBeDefined();
    expect(schemas.MyCustomComponent.description).toBe(
      "A customized component description"
    );
    expect(schemas.Root1.properties.shared_sub_object.$ref).toBe(
      "#/components/schemas/MyCustomComponent"
    );
    expect(schemas.Root2.properties.shared_sub_object.$ref).toBe(
      "#/components/schemas/MyCustomComponent"
    );
    
    // Check that it returns the same component definitions
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("MyCustomComponent");
  });

  it("should process arrays with and without items", () => {
    const schemas: any = {
      Root1: { type: "array", items: { type: "object", properties: { shared: { type: "string" } } } },
      Root2: { type: "array", items: { type: "object", properties: { shared: { type: "string" } } } },
      Root3: { type: "array" },
      Root4: { type: "array" },
    };

    deduplicateSchemas(schemas, undefined);

    // The items should be extracted as a common component if complex enough, or just processed.
    expect(schemas.Root1.items).toBeDefined();
    expect(schemas.Root2.items).toBeDefined();
  });

  it("should process empty objects without properties", () => {
    const schemas: any = {
      Root1: { type: "object" },
      Root2: { type: "object" },
    };
    
    deduplicateSchemas(schemas, undefined);
    
    expect(schemas.Root1.type).toBe("object");
  });

  it("should handle externalized properties like nullable and deprecated", () => {
    const schemas: any = {
      Root1: {
        type: "object",
        properties: {
          shared_sub_object: {
            type: "object",
            nullable: true,
            description: "Original description",
            properties: { prop: { type: "string" }, prop2: { type: "integer" } },
          },
        },
      },
      Root2: {
        type: "object",
        properties: {
          shared_sub_object: {
            type: "object",
            deprecated: true,
            properties: { prop: { type: "string" }, prop2: { type: "integer" } },
          },
        },
      },
    };

    deduplicateSchemas(schemas, undefined);

    const componentName = "shared_sub_object";
    expect(schemas[componentName]).toBeDefined();

    // Verify externalized properties are retained as allOf references
    expect(schemas.Root1.properties.shared_sub_object.allOf).toBeDefined();
    expect(schemas.Root1.properties.shared_sub_object.nullable).toBe(true);
    expect(schemas.Root1.properties.shared_sub_object.description).toBe("Original description");

    expect(schemas.Root2.properties.shared_sub_object.allOf).toBeDefined();
    expect(schemas.Root2.properties.shared_sub_object.deprecated).toBe(true);
  });

  it("should handle name collisions during component extraction", () => {
    const schemas: any = {
      shared_sub_object: { type: "string" }, // Existing schema with this name
      Root1: {
        type: "object",
        properties: {
          shared_sub_object: {
            type: "object",
            properties: { a: { type: "integer" }, b: { type: "integer" } },
          },
        },
      },
      Root2: {
        type: "object",
        properties: {
          shared_sub_object: {
            type: "object",
            properties: { a: { type: "integer" }, b: { type: "integer" } },
          },
        },
      },
    };

    deduplicateSchemas(schemas, undefined);

    // Should create shared_sub_object_1 due to collision
    expect(schemas.shared_sub_object_1).toBeDefined();
    expect(schemas.shared_sub_object_1.properties.a.type).toBe("integer");
    expect(schemas.Root1.properties.shared_sub_object.$ref).toBe("#/components/schemas/shared_sub_object_1");
  });

  it("should merge descriptions correctly", () => {
    const schemas: any = {
      Root1: {
        type: "object",
        properties: {
          shared: {
            type: "object",
            description: "Desc A",
            properties: { a: { type: "integer" }, b: { type: "integer" } },
          },
        },
      },
      Root2: {
        type: "object",
        properties: {
          shared: {
            type: "object",
            description: "Desc B",
            properties: { a: { type: "integer" }, b: { type: "integer" } },
          },
        },
      },
      Root3: {
        type: "object",
        properties: {
          shared: {
            type: "object",
            description: "Desc A", // duplicate desc, shouldn't append again
            properties: { a: { type: "integer" }, b: { type: "integer" } },
          },
        },
      },
    };

    deduplicateSchemas(schemas, undefined);

    // Descriptions should be joined by " | "
    expect(schemas.shared).toBeDefined();
    expect(schemas.shared.description).toContain("Desc A");
    expect(schemas.shared.description).toContain("Desc B");
    expect(schemas.shared.description).toBe("Desc A | Desc B");
  });

  it("should not crash when component contains an array without items", () => {
    const schemas: any = {
      Root1: {
        type: "object",
        properties: {
          shared: {
            type: "object",
            properties: {
              my_array: { type: "array", items: { type: "string" } },
              error: { type: "string" },
            },
          },
        },
      },
      Root2: {
        type: "object",
        properties: {
          shared: {
            type: "object",
            properties: {
              my_array: { type: "array", items: { type: "string" } },
              error: { type: "string" },
            },
          },
        },
      },
    };

    // This will crash if newPartStack gets out of sync
    expect(() => deduplicateSchemas(schemas, undefined)).not.toThrow();
  });

  it("should deduplicate an object with discriminator and oneOf/allOf", () => {
    const zonePayload = {
      "discriminator": {
        "mapping": {
          "primary": "#/components/schemas/ZonePrimary",
          "secondary": "#/components/schemas/ZoneSecondary"
        },
        "propertyName": "mode"
      },
      "oneOf": [
        {
          "allOf": [
            {
              "properties": {
                "authoritative_nameservers": {
                  "properties": {
                    "assigned": {
                      "items": { "type": "string" },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              },
              "type": "object"
            },
            {
              "properties": {
                "mode": { "type": "string" }
              },
              "type": "object"
            }
          ]
        },
        {
          "allOf": [
            {
              "properties": {
                "authoritative_nameservers": {
                  "properties": {
                    "assigned": {
                      "items": { "type": "string" },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              },
              "type": "object"
            },
            {
              "properties": {
                "mode": { "type": "string" }
              },
              "type": "object"
            }
          ]
        }
      ],
      "title": "Zone"
    };

    const schemas: any = {
      Root1: {
        type: "object",
        properties: {
          zone: JSON.parse(JSON.stringify(zonePayload)),
        },
      },
      Root2: {
        type: "object",
        properties: {
          zone: JSON.parse(JSON.stringify(zonePayload)),
        },
      },
    };

    deduplicateSchemas(schemas, undefined);

    // We expect the 'zone' property to be extracted and replaced with a $ref
    // since walkSchema now correctly traverses oneOf/allOf and calculates complexity.
    expect(schemas.Root1.properties.zone["$ref"]).toBeDefined();
    expect(schemas.Root1.properties.zone["$ref"]).toEqual("#/components/schemas/zone");
  });

  it("should extract an object with discriminator and oneOf/allOf when explicitly specified in commonComponents", () => {
    const zonePayload = {
      "discriminator": {
        "mapping": {
          "primary": "#/components/schemas/ZonePrimary",
          "secondary": "#/components/schemas/ZoneSecondary"
        },
        "propertyName": "mode"
      },
      "oneOf": [
        {
          "allOf": [
            {
              "properties": {
                "authoritative_nameservers": {
                  "properties": {
                    "assigned": {
                      "items": { "type": "string" },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              },
              "type": "object"
            },
            {
              "properties": {
                "mode": { "type": "string" }
              },
              "type": "object"
            }
          ]
        },
        {
          "allOf": [
            {
              "properties": {
                "authoritative_nameservers": {
                  "properties": {
                    "assigned": {
                      "items": { "type": "string" },
                      "type": "array"
                    }
                  },
                  "type": "object"
                }
              },
              "type": "object"
            },
            {
              "properties": {
                "mode": { "type": "string" }
              },
              "type": "object"
            }
          ]
        }
      ],
      "title": "Zone"
    };

    const schemas: any = {
      Root1: {
        type: "object",
        properties: {
          zone: JSON.parse(JSON.stringify(zonePayload)),
        },
      },
      Root2: {
        type: "object",
        properties: {
          zone: JSON.parse(JSON.stringify(zonePayload)),
        },
      },
    };

    const commonComponents = [
      {
        path: ["Root1", "zone"],
        name: "ExplicitZone",
        description: "Zone explicitly extracted"
      }
    ];

    deduplicateSchemas(schemas, commonComponents);

    expect(schemas.Root1.properties.zone["$ref"]).toBeDefined();
    expect(schemas.Root1.properties.zone["$ref"]).toEqual("#/components/schemas/ExplicitZone");
  });

  it("should extract a nested object from within a discriminator/oneOf/allOf construct", () => {
    const zonePayload = {
      "discriminator": {
        "mapping": {
          "primary": "#/components/schemas/ZonePrimary",
          "secondary": "#/components/schemas/ZoneSecondary"
        },
        "propertyName": "mode"
      },
      "oneOf": [
        {
          "allOf": [
            {
              "properties": {
                "authoritative_nameservers": {
                  "properties": {
                    "assigned": {
                      "items": { "type": "string" },
                      "type": "array"
                    },
                    "status": {
                      "type": "string"
                    }
                  },
                  "type": "object"
                }
              },
              "type": "object"
            },
            {
              "properties": {
                "mode": { "type": "string" }
              },
              "type": "object"
            }
          ]
        },
        {
          "allOf": [
            {
              "properties": {
                "authoritative_nameservers": {
                  "properties": {
                    "assigned": {
                      "items": { "type": "string" },
                      "type": "array"
                    },
                    "status": {
                      "type": "string"
                    }
                  },
                  "type": "object"
                }
              },
              "type": "object"
            },
            {
              "properties": {
                "mode_alt": { "type": "string" }
              },
              "type": "object"
            }
          ]
        }
      ],
      "title": "Zone"
    };

    const schemas: any = {
      Root1: {
        type: "object",
        properties: {
          zone: JSON.parse(JSON.stringify(zonePayload)),
        },
      }
    };

    const commonComponents = [
      {
        path: ["Root1", "zone", "oneOf[0]", "allOf[0]", "authoritative_nameservers"],
        name: "ExplicitAuthoritativeNameserver",
        description: "Explicitly extracted nameserver"
      }
    ];

    deduplicateSchemas(schemas, commonComponents);

    // Root zone is NOT extracted because it only appears once
    expect(schemas.Root1.properties.zone["$ref"]).toBeUndefined();

    // The nested authoritative_nameservers should be extracted and referenced within the original 'zone'
    const ref0 = schemas.Root1.properties.zone.oneOf[0].allOf[0].properties.authoritative_nameservers["$ref"];
    const ref1 = schemas.Root1.properties.zone.oneOf[1].allOf[0].properties.authoritative_nameservers["$ref"];

    expect(ref0).toBeDefined();
    expect(ref0).toEqual(ref1);
    expect(ref0).toEqual("#/components/schemas/ExplicitAuthoritativeNameserver");
  });

  it("should deduplicate top-level schemas that share the same structure", () => {
    const dnsPtrIpRequest = {
      type: "object",
      properties: {
        dns_ptr: {
          description: "Domain Name to point to.",
          example: "server.example.com",
          nullable: true,
          type: "string",
        },
        ip: {
          description: "Single IPv4 or IPv6 address to create pointer for.",
          example: "2001:db8::1",
          type: "string",
        },
      },
      required: ["ip"],
    };

    const schemas: any = {
      change_reverse_dns_records_for_primary_ip_request: JSON.parse(
        JSON.stringify(dnsPtrIpRequest),
      ),
      change_reverse_dns_entry_for_this_load_balancer_request: JSON.parse(
        JSON.stringify(dnsPtrIpRequest),
      ),
    };

    const result = deduplicateSchemas(schemas, undefined);

    // Both top-level schemas should now be $ref references to the same shared component
    expect(
      schemas.change_reverse_dns_records_for_primary_ip_request.$ref,
    ).toBeDefined();
    expect(
      schemas.change_reverse_dns_entry_for_this_load_balancer_request.$ref,
    ).toBeDefined();
    expect(schemas.change_reverse_dns_records_for_primary_ip_request.$ref).toBe(
      schemas.change_reverse_dns_entry_for_this_load_balancer_request.$ref,
    );

    // A new shared component should have been registered with a top-level path
    const extracted = result.find((c) => c.path.length === 1);
    expect(extracted).toBeDefined();
    expect(schemas[extracted!.name]).toBeDefined();
    expect(schemas[extracted!.name].type).toBe("object");
    expect(schemas[extracted!.name].properties.dns_ptr).toBeDefined();
    expect(schemas[extracted!.name].properties.ip).toBeDefined();
  });
});
