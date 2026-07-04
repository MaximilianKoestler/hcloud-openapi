import { deduplicateSchemas, CommonComponent } from "./transformation";

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
});
