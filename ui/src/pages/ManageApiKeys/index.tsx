import { SkeletonLoader } from "../../components/Skeleton";
import { getUserTokens } from "../../pkg/api/client";
import { useQuery } from "../../pkg/types/utils";

export default () => {
	const apiKeys = useQuery(() => {
		return getUserTokens();
	}, []);

	return (
		<div>
			<h1>API Keys</h1>
			<SkeletonLoader layout="paragraph" pull={apiKeys}>
				{apiKeys.state === "error" && <div>Error loading API keys.</div>}
				{apiKeys.state === "success" && apiKeys.result.length === 0 && <div>No API keys found.</div>}
				{apiKeys.state === "success" && apiKeys.result.length > 0 && (
					<table>
						<thead>
							<tr>
								<th>Name</th>
								<th>Key</th>
								<th>Created At</th>
								<th>Scopes</th>
							</tr>
						</thead>
						<tbody>
							{apiKeys.result?.map((key) => (
								<tr key={key.id}>
									<td>{key.name}</td>
									<td>************{key.id}</td>
									<td>{new Date(key.createdAt).toLocaleDateString()}</td>
									<td>{key.scopes.join(", ")}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</SkeletonLoader>
		</div>
	);
};
