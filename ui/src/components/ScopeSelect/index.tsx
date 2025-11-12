interface ScopeSelectProps {
	selectedScopes: string[];
	onChange: (scopes: string[]) => void;
}

export default ({ selectedScopes, onChange }: ScopeSelectProps) => {
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
				onChange(["*", ...availableScopes]);
			} else {
				onChange([]);
			}
		} else {
			// Handle individual scope
			const newScopes = checked ? [...selectedScopes, scope] : selectedScopes.filter((s) => s !== scope && s !== "*");
			onChange(newScopes);
		}
	};

	return (
		<div class="space-y-2">
			<label class="flex items-center">
				<input
					type="checkbox"
					checked={selectedScopes.includes("*")}
					onChange={(e) => handleScopeChange("*", e.currentTarget.checked)}
					class="mr-2"
				/>
				<span class="text-sm text-[color:var(--text-color)]">All permissions (*)</span>
			</label>
			{availableScopes.map((scope) => (
				<label key={scope} class="flex items-center">
					<input
						type="checkbox"
						checked={selectedScopes.includes(scope)}
						onChange={(e) => handleScopeChange(scope, e.currentTarget.checked)}
						class="mr-2"
					/>
					<span class="text-sm text-[color:var(--text-color)]">{scope}</span>
				</label>
			))}
		</div>
	);
};
