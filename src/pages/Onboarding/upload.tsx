import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/16/solid";

export enum UploadStatus {
  NotUploaded = "not uploaded",
  Uploading = "uploading",
  Uploaded = "uploaded",
  Error = "error",
}

export const getUploadIcon = (s: UploadStatus) => {
  switch (s) {
    case UploadStatus.NotUploaded:
      return <ArrowUpTrayIcon class="inline size-5" />;
    case UploadStatus.Uploading:
      return <ArrowPathIcon class="animate-spin inline size-5" />;
    case UploadStatus.Uploaded:
      return <CheckCircleIcon class="size-5 inline" />;
    case UploadStatus.Error:
      return <XCircleIcon class="size-5 inline" />;
  }
};
