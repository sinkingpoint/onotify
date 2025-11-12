import "./styles.css";

interface ToastProps {
	message: string;
	durationMs?: number;
	style: "success" | "error" | "info" | "warning";
}

export default ({ message, durationMs, style }: ToastProps) => {
	return (
		<div className={`toast toast-${style}`} style={{ animationDuration: `${durationMs || 3000}ms` }}>
			{message}
		</div>
	);
};
