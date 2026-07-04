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
});
