module.exports = {
	root: true,
	env: {
		node: true,
		browser: true,
	},
	extends: ["plugin:@typescript-eslint/recommended", "eslint:recommended"],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
	},
	plugins: ["@typescript-eslint"],
	rules: {
		"@typescript-eslint/no-unused-vars": 2,
		"no-unused-vars": 0,
	},
};
