export const getURLSearchParams = () => {
	if (typeof window !== "undefined") {
		return new URLSearchParams(window.location.search);
	}

	return new URLSearchParams();
};
