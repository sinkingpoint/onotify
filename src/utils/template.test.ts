import { getTemplateKeys } from "./template";

test("getTemplateKeys", () => {
	expect(getTemplateKeys(["foo", "bar"], ["foo"])).toEqual(["foo"]);
	expect(getTemplateKeys(["foo", "templates/foo.tmpl", "templates/bar.tmpl"], ["templates/*.tmpl"])).toEqual([
		"templates/foo.tmpl",
		"templates/bar.tmpl",
	]);
});
