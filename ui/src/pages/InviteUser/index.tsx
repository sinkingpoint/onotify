import { useState } from "preact/hooks";
import { Button } from "../../components/Button";
import ScopeSelect from "../../components/ScopeSelect";
import { TextBox } from "../../components/TextBox";
import Toast from "../../components/Toast";
import { postUsers } from "../../pkg/api/client";

export default () => {
	const [scopes, setScopes] = useState<string[]>([]);
	const [email, setEmail] = useState("");
	const [toast, setToast] = useState<{ message: string; style: "success" | "error" | "info" | "warning" } | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const checkFormValidity = () => {
		const emailInput = document.getElementById("email") as HTMLInputElement;

		if (emailInput.value.trim() === "") {
			emailInput.setCustomValidity("Email is required");
			emailInput.reportValidity();
			return false;
		}

		if (scopes.length === 0) {
			const firstScopeCheckbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
			if (firstScopeCheckbox) {
				firstScopeCheckbox.setCustomValidity("Please select at least one scope");
				firstScopeCheckbox.reportValidity();
			}
			return false;
		}

		return true;
	};

	const onSubmit = async (e: Event) => {
		e.preventDefault();
		setIsSubmitting(true);
		if (!checkFormValidity()) {
			setIsSubmitting(false);
			return;
		}

		const result = await postUsers({ body: { email, scopes } });
		if (result.error) {
			setToast({ message: `Error inviting user`, style: "error" });
			setIsSubmitting(false);
			return;
		}

		window.location.href = "/account/users";
	};

	return (
		<div class="w-full flex flex-col">
			<h1>Invite User</h1>
			<form onSubmit={onSubmit}>
				<label for="email" class="block mb-2">
					<h4>Email Address</h4>
				</label>
				<TextBox
					id="email"
					type="email"
					placeholder="Enter email address"
					value={email}
					onInput={(e) => setEmail(e.currentTarget.value)}
				/>
				<label class="block my-2">
					<h4>Select Scopes</h4>
				</label>
				<ScopeSelect selectedScopes={scopes} onChange={setScopes} />
				<Button
					text={isSubmitting ? "Inviting..." : "Invite User"}
					color="success"
					type="submit"
					disabled={isSubmitting}
					class="w-full justify-center py-2 px-4"
				/>
			</form>

			{toast && <Toast message={toast.message} style={toast.style} durationMs={5000} />}
		</div>
	);
};
