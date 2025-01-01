import { buildTrie } from "./trie";
import { UploadStatus } from "./upload";

test("no nodes", () => {
	expect(buildTrie([])).toEqual([]);
});

test("one node", () => {
	expect(
		buildTrie([
			{
				path: "/etc/test/foo",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
		]),
	).toEqual([
		{
			path: "/etc/test/foo",
			isDir: false,
			uploaded: UploadStatus.NotUploaded,
			children: [],
		},
	]);
});

test("common prefix", () => {
	expect(
		buildTrie([
			{
				path: "/etc/test/foo",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
			{
				path: "/etc/test/bar",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
			{
				path: "/etc/test/baz",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
		]),
	).toEqual([
		{
			path: "/etc/test",
			isDir: true,
			uploaded: UploadStatus.NotUploaded,
			children: [
				{
					path: "foo",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
				{
					path: "bar",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
				{
					path: "baz",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
			],
		},
	]);
});

test("two prefixs", () => {
	expect(
		buildTrie([
			{
				path: "/etc/test/foo",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
			{
				path: "/etc/test/bar",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
			{
				path: "/var/log/baz",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
		]),
	).toEqual([
		{
			path: "/etc/test",
			isDir: true,
			uploaded: UploadStatus.NotUploaded,
			children: [
				{
					path: "foo",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
				{
					path: "bar",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
			],
		},
		{
			path: "/var/log/baz",
			isDir: false,
			uploaded: UploadStatus.NotUploaded,
			children: [],
		},
	]);
});

test("files and dirs", () => {
	expect(
		buildTrie([
			{
				path: "/etc/test/foo",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
			{
				path: "/etc/test/bar",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
			{
				path: "/etc/test/baz/foo",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
			{
				path: "/etc/test/baz/bar",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
		]),
	).toEqual([
		{
			path: "/etc/test",
			isDir: true,
			uploaded: UploadStatus.NotUploaded,
			children: [
				{
					path: "foo",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
				{
					path: "bar",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
				{
					path: "baz",
					isDir: true,
					uploaded: UploadStatus.NotUploaded,
					children: [
						{
							path: "foo",
							isDir: false,
							uploaded: UploadStatus.NotUploaded,
							children: [],
						},
						{
							path: "bar",
							isDir: false,
							uploaded: UploadStatus.NotUploaded,
							children: [],
						},
					],
				},
			],
		},
	]);
});

test("relative files", () => {
	expect(
		buildTrie([
			{
				path: "/etc/foo/bar",
				isDir: false,
				uploaded: UploadStatus.NotUploaded,
			},
			{ path: "./foo", isDir: false, uploaded: UploadStatus.NotUploaded },
			{ path: "./bar", isDir: false, uploaded: UploadStatus.NotUploaded },
		]),
	).toEqual([
		{
			path: "/etc/foo/bar",
			isDir: false,
			uploaded: UploadStatus.NotUploaded,
			children: [],
		},
		{
			path: ".",
			isDir: true,
			uploaded: UploadStatus.NotUploaded,
			children: [
				{
					path: "foo",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
				{
					path: "bar",
					isDir: false,
					uploaded: UploadStatus.NotUploaded,
					children: [],
				},
			],
		},
	]);
});
