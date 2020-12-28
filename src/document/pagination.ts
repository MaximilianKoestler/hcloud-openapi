import { OpenApiDocumentFragment } from "../types";

function addPaginationMetaDataToSchema(
  schema: OpenApiDocumentFragment
): boolean {
  if (schema.type == "object") {
    const property_keys = Object.keys(schema.properties);
    if (property_keys.length == 1) {
      if (schema.properties[property_keys[0]].type == "array") {
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
        has_response_with_pages || addPaginationMetaDataToSchema(schema);
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
        // return;
      }
    }
  }
}
