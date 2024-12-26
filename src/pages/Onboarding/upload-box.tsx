import {
  ArrowUpOnSquareIcon,
  ArrowUpOnSquareStackIcon,
} from "@heroicons/react/16/solid";

interface UploadBoxProps {
  selected?: {
    path: string;
    isDir: boolean;
  };
}

export const UploadBox = ({ selected }: UploadBoxProps) => {
  let contents = <></>;
  if (selected) {
    const { path, isDir } = selected;
    let icon;
    if (isDir) {
      icon = <ArrowUpOnSquareStackIcon class="inline size-72" />;
    } else {
      icon = <ArrowUpOnSquareIcon class="inline size-72" />;
    }

    contents = (
      <>
        {icon}
        <span class="font-bold">{path}</span>
      </>
    );
  }

  return (
    <span class="upload-box flex flex-col justify-center items-center">
      <input
        id="upload"
        type="file"
        multiple={selected ? selected.isDir : false}
        style={{ display: "none" }}
      />

      <label for="upload">
        <div class="flex flex-col justify-center items-center">{contents}</div>
      </label>
    </span>
  );
};
