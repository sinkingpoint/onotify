import { Tab, TabPane } from "../../components/TabPane";
import ApiKeys from "./api-keys";
import UserInfo from "./user-info";

export default () => {
	return (
		<div class="w-full h-full flex flex-col">
			<TabPane>
				<Tab name="User Info">
					<UserInfo />
				</Tab>

				<Tab name="API Keys">
					<ApiKeys />
				</Tab>
			</TabPane>
		</div>
	);
};
