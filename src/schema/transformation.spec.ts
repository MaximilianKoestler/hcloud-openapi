import { deduplicateSchemas } from "./transformation";
import * as fs from "fs";

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe("deduplicateSchemas", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should process a simple schema without errors when fromFile is false", async () => {
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

    await deduplicateSchemas(schemas, false);

    expect(fs.promises.writeFile).toHaveBeenCalled();
  });

  it("should process a schema using fromFile true", async () => {
    const schemas: any = {
      TestSchema: {
        type: "object",
        properties: {
          id: { type: "integer" },
        },
      },
    };

    const mockCommonComponents = [
      {
        name: "TestComponent",
        path: ["TestSchema", "properties", "id"],
        description: "A test component",
      },
    ];

    (fs.promises.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify(mockCommonComponents)
    );
    (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

    await deduplicateSchemas(schemas, true);

    expect(fs.promises.readFile).toHaveBeenCalledWith(
      "resources/schema_types.json",
      "utf-8"
    );
  });
  it("should extract a complex shared sub-object as a component when fromFile is false", async () => {
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

    await deduplicateSchemas(schemas, false);

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

    // Verify it was written to file
    expect(fs.promises.writeFile).toHaveBeenCalled();
  });

  it("should apply an extracted component using fromFile true", async () => {
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

    const mockCommonComponents = [
      {
        name: "MyCustomComponent",
        path: ["Root1", "shared_sub_object"],
        description: "A customized component description",
      },
    ];

    (fs.promises.readFile as jest.Mock).mockResolvedValue(
      JSON.stringify(mockCommonComponents)
    );
    (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);

    await deduplicateSchemas(schemas, true);

    expect(fs.promises.readFile).toHaveBeenCalledWith(
      "resources/schema_types.json",
      "utf-8"
    );

    // Check that it used the customized name from the file
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
  });
});
