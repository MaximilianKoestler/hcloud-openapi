const fs = require("fs").promises;

import objectPath = require("object-path");

import { OpenApiDocumentFragment } from "../types";

interface Transformation {
  path: string[];
  set?: { [key: string]: any };
  remove?: string[];
  add?: any;
  sort?: boolean;
}

function applyTransformation(
  document: OpenApiDocumentFragment,
  transformation: Transformation
) {
  if (!objectPath.has(document, transformation.path)) {
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
    transformation.remove.forEach((name) => {
      console.log(transformation.path, name);
      objectPath.del(document, transformation.path.concat([name]));
    });
  }

  if (transformation.add !== undefined) {
    let value = objectPath.get(document, transformation.path);
    if (!value.includes(transformation.add)) {
      objectPath.push(document, transformation.path, transformation.add);
    }
  }

  if (transformation.sort !== undefined) {
    if (transformation.sort) {
      let value = objectPath.get(document, transformation.path);
      value.sort();
      objectPath.set(document, transformation.path, value);
    }
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
