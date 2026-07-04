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
          name: { type: "string" },
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
});
