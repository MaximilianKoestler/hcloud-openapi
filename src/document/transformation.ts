const fs = require("fs").promises;

import objectPath = require("object-path");

import { OpenApiDocumentFragment } from "../types";

interface Transformation {
  path: string[];
  set?: { [key: string]: any };
  remove?: string[];
}

function applyTransformation(
  document: OpenApiDocumentFragment,
  transformation: Transformation
) {
  if (objectPath.get(document, transformation.path) === undefined) {
    throw Error(
      `Found transformation with invalid path: ${transformation.path.join("/")}`
    );
  }

  if (transformation.set !== undefined) {
    Object.entries(transformation.set).forEach(([key, value]) => {
      objectPath.set(document, transformation.path.concat([key]), value);
    });
  }

  if (transformation.remove !== undefined) {
    transformation.remove.forEach(name => {
      objectPath.del(document, transformation.path.concat([name]));
    });
  }
}

export async function transformDocument(document: OpenApiDocumentFragment) {
  const json = await fs.readFile(
    "resources/document_transformations.json",
    "utf-8"
  );
  let transformations: Transformation[] = JSON.parse(json);
  transformations.forEach((transformation) =>
    applyTransformation(document, transformation)
  );
}
