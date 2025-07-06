import { createContext } from "preact";
import { useContext } from "preact/hooks";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
	const auth = useContext(AuthContext);

	return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
