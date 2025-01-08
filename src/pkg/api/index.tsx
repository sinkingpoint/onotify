const API_HOST = "http://localhost:8787/api/v1";
export class APIClient {
	async uploadConfig(config: string) {
		return fetch(this.apiURL("/config"), {
			method: "POST",
			body: config,
			headers: {
				Authorization: "Bearer notify-test",
				"Content-Type": "application/json",
			},
		});
	}

	async getConfig() {
		return fetch(this.apiURL("/config"), {
			method: "GET",
			headers: {
				Authorization: "Bearer notify-test",
			},
		});
	}

	async getRequiredConfigFiles() {
		return fetch(this.apiURL("/config/required-files"), {
			method: "GET",
			headers: {
				Authorization: "Bearer notify-test",
			},
		});
	}

	async uploadFile(path: string, contents: string) {
		return fetch(this.apiURL("/config/required-files"), {
			method: "POST",
			headers: {
				Authorization: "Bearer notify-test",
			},
			body: JSON.stringify({ path, contents }),
		});
	}

	async getAlert(fingerprint: string) {
		return (
			await fetch(`http://localhost:8787/api/v2/alerts?fingerprints=${fingerprint}`, {
				method: "GET",
				headers: {
					Authorization: "Bearer notify-test",
				},
			})
		).json();
	}

	private apiURL(path: string) {
		return `${API_HOST}${path}`;
	}
}
