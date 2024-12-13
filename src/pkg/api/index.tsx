import { AlertmanagerConfig } from "../types/alertmanager";

const API_HOST = "";
export class APIClient {
  async uploadConfig(conf: AlertmanagerConfig) {
    return fetch(this.apiURL("/upload-config"), {
      method: "POST",
      headers: {
        "Authorization": "Bearer notify-test",
      }
    });
  }

  private apiURL(path: string) {
    return `${API_HOST}${path}`;
  }
}