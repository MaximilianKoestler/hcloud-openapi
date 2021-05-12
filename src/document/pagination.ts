import { OpenApiDocumentFragment } from "../types";

function addPaginationMetadataToProperties(
  properties: OpenApiDocumentFragment
) {
  properties.meta = {
    type: "object",
    description: "Metadata contained in the response",
    properties: {
      pagination: {
        description:
          "Information about the current pagination. The keys previous_page, next_page, last_page, and total_entries may be null when on the first page, last page, or when the total number of entries is unknown",
        type: "object",
        properties: {
          page: { type: "integer", description: "The current page number" },
          per_page: {
            type: "integer",
            description: "The number of entries per page",
          },
          previous_page: {
            type: "integer",
            nullable: true,
            description: "The previous page number",
          },
          next_page: {
            type: "integer",
            nullable: true,
            description: "The next page number",
          },
          last_page: {
            type: "integer",
            nullable: true,
            description: "The last page number",
          },
          total_entries: {
            type: "integer",
            nullable: true,
            description: "The total number of entries",
          },
        },
        required: [
          "page",
          "per_page",
          "previous_page",
          "next_page",
          "last_page",
          "total_entries",
        ],
      },
    },
    required: ["pagination"],
  };
}

function addPaginationMetadataToSchema(
  schema: OpenApiDocumentFragment
): boolean {
  if (schema.type == "object") {
    const property_keys = Object.keys(schema.properties);
    if (property_keys.includes("meta")) {
      return true;
    } else if (property_keys.length == 1) {
      if (schema.properties[property_keys[0]].type == "array") {
        addPaginationMetadataToProperties(schema.properties);
        return true;
      }
    }
  }
  return false;
}

function addPaginationToVerb(verb_data: OpenApiDocumentFragment) {
  let has_response_with_pages = false;
  for (const [status_code, response_obj] of Object.entries(
    verb_data.responses
  )) {
    const response_data = response_obj as OpenApiDocumentFragment;
    const schema = response_data?.content?.["application/json"]?.schema;

    if (schema !== undefined) {
      has_response_with_pages =
        has_response_with_pages || addPaginationMetadataToSchema(schema);
    }
  }

  if (has_response_with_pages) {
    const parameters = verb_data.parameters as any[];
    parameters.push({
      name: "page",
      in: "query",
      description:
        "Specifies the page to fetch. The number of the first page is 1",
      required: false,
      schema: { type: "integer", minimum: 1 },
    });
    parameters.push({
      name: "per_page",
      in: "query",
      description:
        "Specifies the number of items returned per page. The default value is 25, the maximum value is 50 except otherwise specified in the documentation.",
      required: false,
      schema: { type: "integer", minimum: 1, maximum: 50 },
    });
  }
}

export function addPagination(document: OpenApiDocumentFragment) {
  const paths = document.paths as OpenApiDocumentFragment;

  for (const [_path, path_obj] of Object.entries(paths)) {
    for (const [verb, verb_obj] of Object.entries(path_obj)) {
      if (verb == "get") {
        addPaginationToVerb(verb_obj as OpenApiDocumentFragment);
      }
    }
  }
}
