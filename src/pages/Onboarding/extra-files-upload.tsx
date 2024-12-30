import { MouseEventHandler } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { APIClient } from "../../pkg/api";
import { buildTrie, NeededFile, trieNode } from "./trie";
import { getUploadIcon } from "./upload";
import { UploadBox } from "./upload-box";

const trieToList = (
  parentPath: string,
  roots: trieNode[],
  onClick: MouseEventHandler<HTMLLIElement>
) => {
  return roots.map((r) => {
    let filePath = r.path;
    if (parentPath) {
      filePath = `${parentPath}/${filePath}`;
    }

    if (r.children.length === 0) {
      return (
        <li data-file-path={filePath} data-is-dir={r.isDir} onClick={onClick}>
          <span>
            {getUploadIcon(r.uploaded)}
            {r.path}
          </span>
        </li>
      );
    } else {
      return (
        <li data-file-path={filePath} data-is-dir={r.isDir} onClick={onClick}>
          <span>
            {getUploadIcon(r.uploaded)}
            {r.path}
          </span>
          <ul>{trieToList(filePath, r.children, onClick)}</ul>
        </li>
      );
    }
  });
};

export const ExtraFilesUpload = () => {
  const [secrets, setSecrets] = useState<NeededFile[]>([]);
  const [templates, setTemplates] = useState<NeededFile[]>([]);
  const [selected, setSelected] = useState<HTMLLIElement>();

  useEffect(() => {
    const fetchNeeded = async () => {
      const { secrets, templates } = await (
        await new APIClient().getRequiredConfigFiles()
      ).json();
      setSecrets(
        secrets.map((s) => {
          if (
            !s.startsWith("/") &&
            !s.startsWith("./") &&
            !s.startsWith("../")
          ) {
            s = `./${s}`;
          }
          return { path: s, uploaded: false };
        })
      );

      setTemplates(
        templates.map((t) => {
          if (
            !t.path.startsWith("/") &&
            !t.path.startsWith("./") &&
            !t.path.startsWith("../")
          ) {
            t.path = `./${t.path}`;
          }

          return {
            isDir: t.isDir,
            path: t.path,
            uploaded: false,
          };
        })
      );
    };

    fetchNeeded();
  }, []);

  const selectedClass = "selected";
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (selected) {
      selected.classList.remove(selectedClass);
    }

    (e.currentTarget as HTMLLIElement).classList.add(selectedClass);
    setSelected(e.currentTarget as HTMLLIElement);
  };

  let selectedData;
  if (selected) {
    selectedData = {
      isDir: selected.dataset["isDir"] === "true",
      path: selected.dataset["filePath"],
    };
  }

  return (
    <>
      <h1 class="text-3xl font-bold my-3">
        We're gonna need a few extra files
      </h1>

      <h2 class="text-lg my-3">
        Your config has a few external files that we'll need. You can upload
        them now, or wait until later. Things will continue to work, but any
        receivers that use un-uploaded files might not.
      </h2>

      <div class="flex flex-row justify-between">
        <div class="flex flex-col justify-between overflow-scroll">
          <span class="list-tree">
            <h2 class="text-lg my-3 font-bold">Templates</h2>
            <ul>{trieToList("", buildTrie(templates), onClick)}</ul>
          </span>

          <span class="list-tree">
            <h2 class="text-lg my-3 font-bold">Secrets</h2>
            <ul>{trieToList("", buildTrie(secrets), onClick)}</ul>
          </span>
        </div>

        <UploadBox selected={selectedData} />
      </div>
    </>
  );
};
