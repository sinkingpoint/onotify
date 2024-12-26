import { buildTrie } from "./trie";

test("no nodes", () => {
  expect(buildTrie([])).toEqual([]);
});

test("one node", () => {
  expect(
    buildTrie([{ path: "/etc/test/foo", isDir: false, uploaded: false }])
  ).toEqual([
    {
      path: "/etc/test/foo",
      isDir: false,
      uploaded: false,
      children: [],
    },
  ]);
});

test("common prefix", () => {
  expect(
    buildTrie([
      { path: "/etc/test/foo", isDir: false, uploaded: false },
      { path: "/etc/test/bar", isDir: false, uploaded: false },
      { path: "/etc/test/baz", isDir: false, uploaded: false },
    ])
  ).toEqual([
    {
      path: "/etc/test",
      isDir: true,
      uploaded: false,
      children: [
        {
          path: "foo",
          isDir: false,
          uploaded: false,
          children: [],
        },
        {
          path: "bar",
          isDir: false,
          uploaded: false,
          children: [],
        },
        {
          path: "baz",
          isDir: false,
          uploaded: false,
          children: [],
        },
      ],
    },
  ]);
});

test("two prefixs", () => {
  expect(
    buildTrie([
      { path: "/etc/test/foo", isDir: false, uploaded: false },
      { path: "/etc/test/bar", isDir: false, uploaded: false },
      { path: "/var/log/baz", isDir: false, uploaded: false },
    ])
  ).toEqual([
    {
      path: "/etc/test",
      isDir: true,
      uploaded: false,
      children: [
        {
          path: "foo",
          isDir: false,
          uploaded: false,
          children: [],
        },
        {
          path: "bar",
          isDir: false,
          uploaded: false,
          children: [],
        },
      ],
    },
    {
      path: "/var/log/baz",
      isDir: false,
      uploaded: false,
      children: [],
    },
  ]);
});

test("files and dirs", () => {
  expect(
    buildTrie([
      { path: "/etc/test/foo", isDir: false, uploaded: false },
      { path: "/etc/test/bar", isDir: false, uploaded: false },
      { path: "/etc/test/baz/foo", isDir: false, uploaded: false },
      { path: "/etc/test/baz/bar", isDir: false, uploaded: false },
    ])
  ).toEqual([
    {
      path: "/etc/test",
      isDir: true,
      uploaded: false,
      children: [
        {
          path: "foo",
          isDir: false,
          uploaded: false,
          children: [],
        },
        {
          path: "bar",
          isDir: false,
          uploaded: false,
          children: [],
        },
        {
          path: "baz",
          isDir: true,
          uploaded: false,
          children: [
            {
              path: "foo",
              isDir: false,
              uploaded: false,
              children: [],
            },
            {
              path: "bar",
              isDir: false,
              uploaded: false,
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
      { path: "/etc/foo/bar", isDir: false, uploaded: false },
      { path: "./foo", isDir: false, uploaded: false },
      { path: "./bar", isDir: false, uploaded: false },
    ])
  ).toEqual([
    { path: "/etc/foo/bar", isDir: false, uploaded: false, children: [] },
    {
      path: ".",
      isDir: true,
      uploaded: false,
      children: [
        {
          path: "foo",
          isDir: false,
          uploaded: false,
          children: [],
        },
        {
          path: "bar",
          isDir: false,
          uploaded: false,
          children: [],
        },
      ],
    },
  ]);
});
