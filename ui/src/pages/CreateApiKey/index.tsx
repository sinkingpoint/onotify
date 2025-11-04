import { useState } from "preact/hooks";
import { Button } from "../../components/Button";
import InfoBox from "../../components/InfoBox";
import { TextBox } from "../../components/TextBox";
import { postApiKey } from "../../pkg/api/client";

export default () => {
	const [name, setName] = useState("");
	const [scopes, setScopes] = useState<string[]>([]);
	const [expiresInDays, setExpiresInDays] = useState<number | undefined>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>();
	const [success, setSuccess] = useState<string>();
	const [newApiKey, setNewApiKey] = useState<string>();

	// Available scopes - you might want to fetch these from an API or config
	const availableScopes = [
		"acknowledge-alert",
		"read-api-keys",
		"write-api-keys",
		"read-alerts",
		"write-alerts",
		"read-config",
		"write-config",
		"read-silences",
		"write-silences",
		"read-users",
		"write-alert-history",
	];

	const handleScopeChange = (scope: string, checked: boolean) => {
		if (scope === "*") {
			// If "All permissions" is toggled, set all scopes or clear all
			if (checked) {
				setScopes(["*", ...availableScopes]);
			} else {
				setScopes([]);
			}
		} else {
			// Handle individual scope
			const newScopes = checked ? [...scopes, scope] : scopes.filter((s) => s !== scope && s !== "*");
			setScopes(newScopes);
		}
	};

	const checkFormValidity = () => {
		const nameInput = document.getElementById("name") as HTMLInputElement;

		if (name.trim() === "") {
			nameInput.setCustomValidity("Name cannot be empty");
			nameInput.reportValidity();
			return false;
		}

		if (scopes.length === 0) {
			// Focus on the first scope checkbox for better UX
			const firstScopeCheckbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
			if (firstScopeCheckbox) {
				firstScopeCheckbox.setCustomValidity("Please select at least one scope");
				firstScopeCheckbox.reportValidity();
			}
			return false;
		}

		return true;
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();

		if (!checkFormValidity()) {
			return;
		}

		setIsSubmitting(true);
		setError(undefined);
		setSuccess(undefined);
		setNewApiKey(undefined);

		try {
			const result = await postApiKey({
				body: {
					name: name,
					scopes: scopes.includes("*") ? ["*"] : scopes,
					expiresInDays: expiresInDays || undefined,
				},
			});

			setSuccess("API key created successfully!");
			setNewApiKey(result.data.key);

			// Reset form
			setName("");
			setScopes([]);
			setExpiresInDays(undefined);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create API key");
		} finally {
			setIsSubmitting(false);
		}
	};

	const copyToClipboard = async () => {
		if (newApiKey) {
			await navigator.clipboard.writeText(newApiKey);
		}
	};

	return (
		<div class="w-full h-full flex flex-col">
			<h2 class="text-xl font-semibold mb-4 text-[color:var(--text-color)]">Create New API Key</h2>

			{error && <InfoBox style="error" text={error} class="mb-4" />}

			{success && newApiKey && (
				<div
					class="mb-4 p-3 border-2 rounded"
					style="background-color: var(--success-bg); border-color: var(--success-border); color: var(--success-text);"
				>
					<p class="font-semibold">{success}</p>
					<div class="mt-2">
						<label class="block text-sm font-medium" style="color: var(--success-text-dark);">
							Your API Key (save this now):
						</label>
						<div class="flex mt-1">
							<TextBox
								value={newApiKey}
								readonly
								class="flex-1 font-mono text-sm"
								style="background-color: var(--success-input-bg);"
								button={<Button text="Copy" color="success" onClick={copyToClipboard} />}
								onButtonClick={copyToClipboard}
							/>
						</div>
						<p class="text-xs mt-1" style="color: var(--success-text-muted);">
							This key will only be shown once. Make sure to save it securely.
						</p>
					</div>
				</div>
			)}

			<form onSubmit={handleSubmit} class="space-y-4">
				<div>
					<label for="name" class="block text-sm font-medium text-[color:var(--text-color)] mb-2">
						Name
					</label>
					<TextBox id="name" value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="My Api Key" />
				</div>

				<div>
					<label class="block text-sm font-medium text-[color:var(--text-color)] mb-2">Scopes</label>
					<div class="space-y-2">
						<label class="flex items-center">
							<input
								type="checkbox"
								checked={scopes.includes("*")}
								onChange={(e) => handleScopeChange("*", e.currentTarget.checked)}
								class="mr-2"
							/>
							<span class="text-sm text-[color:var(--text-color)]">All permissions (*)</span>
						</label>
						{availableScopes.map((scope) => (
							<label key={scope} class="flex items-center">
								<input
									type="checkbox"
									checked={scopes.includes(scope)}
									onChange={(e) => handleScopeChange(scope, e.currentTarget.checked)}
									class="mr-2"
								/>
								<span class="text-sm text-[color:var(--text-color)]">{scope}</span>
							</label>
						))}
					</div>
				</div>

				<div>
					<label for="expiresInDays" class="block text-sm font-medium text-[color:var(--text-color)] mb-2">
						Expires in (days)
					</label>
					<TextBox
						id="expiresInDays"
						type="number"
						value={expiresInDays?.toString() || ""}
						onInput={(e) => {
							const value = parseInt(e.currentTarget.value);
							setExpiresInDays(isNaN(value) ? undefined : value);
						}}
						placeholder="30 (optional)"
					/>
					<p class="text-xs text-[color:var(--text-color)] mt-1">Leave empty for no expiration. Maximum 365 days.</p>
				</div>

				<Button
					text={isSubmitting ? "Creating..." : "Create API Key"}
					color="success"
					type="submit"
					disabled={isSubmitting}
					class="w-full justify-center py-2 px-4"
				/>
			</form>
		</div>
	);
};
