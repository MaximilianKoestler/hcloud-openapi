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
          page: {
            type: "integer",
            format: "int64",
            description: "Current page number"
          },
          per_page: {
            type: "integer",
            format: "int64",
            description: "Maximum number of items shown per page in the response",
          },
          previous_page: {
            type: "integer",
            format: "int64",
            nullable: true,
            description: "ID of the previous page. Can be null if the current page is the first one.",
          },
          next_page: {
            type: "integer",
            format: "int64",
            nullable: true,
            description: "ID of the next page. Can be null if the current page is the last one.",
          },
          last_page: {
            type: "integer",
            format: "int64",
            nullable: true,
            description: "ID of the last page available. Can be null if the current page is the last one.",
          },
          total_entries: {
            type: "integer",
            format: "int64",
            nullable: true,
            description: "The total number of entries that exist in the database for this query. Nullable if unknown.",
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
