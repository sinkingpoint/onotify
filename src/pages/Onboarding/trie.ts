import { UploadStatus } from "./upload";

export interface NeededFile {
  uploaded: UploadStatus;
  isDir: boolean;
  path: string;
}

export type trieNode = NeededFile & {
  children: trieNode[];
};

export const buildTrie = (files: NeededFile[]) => {
  const roots: trieNode[] = [];
  for (const file of files) {
    let components = file.path.split("/");
    if (components[0] === "" && components.length > 1) {
      // Restore the first / if it existed.
      components[1] = `/${components[1]}`;
      components = components.slice(1);
    }

    let next = roots.find((r) => r.path === components[0]);
    if (!next) {
      next = {
        uploaded: UploadStatus.NotUploaded,
        isDir: true,
        path: components[0],
        children: [],
      };

      roots.push(next);
    }

    for (let i = 1; i < components.length; i++) {
      let nextNext = next.children.find((c) => c.path === components[i]);
      if (!nextNext) {
        const newNode = {
          uploaded: UploadStatus.NotUploaded,
          isDir: i < components.length - 1 ? true : file.isDir,
          path: components[i],
          children: [],
        };

        next.children.push(newNode);
        nextNext = newNode;
      }

      next = nextNext;
    }

    next.uploaded = file.uploaded;
  }

  return roots.map((r) => collapseTrie(r));
};

const collapseTrie = (parent: trieNode) => {
  if (parent.children.length === 0) {
    return parent;
  }

  if (parent.children.length > 1) {
    parent.children = parent.children.map((r) => collapseTrie(r));
    parent.uploaded = parent.children.every(
      (c) => c.uploaded === UploadStatus.Uploaded
    )
      ? UploadStatus.Uploaded
      : UploadStatus.NotUploaded;
    return parent;
  }

  // We have one child, collapse it into the parent.
  const child = collapseTrie(parent.children[0]);
  if (parent.path) {
    parent.path = `${parent.path}/${child.path}`;
  } else {
    parent.path = child.path;
  }

  parent.isDir = child.isDir;
  parent.uploaded = child.uploaded;
  parent.children = child.children;
  return parent;
};
