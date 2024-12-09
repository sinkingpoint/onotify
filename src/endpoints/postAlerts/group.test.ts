import { AlertState } from "../../types/internal";
import {
  AlertmanagerConfigSpec,
  collapseRoutingTree,
} from "../../types/alertmanager";
import { fingerprint } from "../utils/fingerprinting";
import { groupAlerts } from "./group";
import { load } from "js-yaml";

const parseRawConfig = (raw: string) => {
  const config = load(raw);
  const parsedConfig = AlertmanagerConfigSpec.parse(config);
  return collapseRoutingTree(parsedConfig);
};

const activeStartsAt = Date.now() - 5 * 1000;
const activeEndsAt = Date.now() + 5 * 60 * 1000;
const resolvedStartsAt = Date.now() - 5 * 1000;
const resolvedEndsAt = Date.now() - 1 * 1000;

const alerts = (
  static_labels: Record<string, string>,
  vary_labels: string[],
  resolved: boolean,
  num: number
) => {
  const alerts = [];
  for (let i = 0; i < num; i++) {
    let startsAt, endsAt;
    if (resolved) {
      startsAt = resolvedStartsAt;
      endsAt = resolvedEndsAt;
    } else {
      startsAt = activeStartsAt;
      endsAt = activeEndsAt;
    }

    const labels = { ...static_labels };
    for (const key of vary_labels) {
      labels[key] = `test${i}`;
    }

    let alert = {
      startsAt,
      endsAt,
      annotations: {},
      labels,
    };

    alerts.push(alert);
  }

  return alerts;
};

test("basic routing", () => {
  const tree = parseRawConfig(`
route:
  group_by: ['alertname']
  receiver: 'web.hook'
receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'
`);

  const alert = alerts({ alertname: "foo" }, [], false, 1);
  const [groups, _] = groupAlerts(alert, tree);

  const nodeID = Object.keys(groups)[0];

  expect(Object.keys(groups).length).toEqual(1);
  // We should get one group, pointing to web.hook.
  expect(groups[nodeID]).toEqual([
    {
      nodeID,
      labelNames: ["alertname"],
      labelValues: ["foo"],
      receiver: "web.hook",
      alerts: [
        {
          fingerprint: fingerprint({ alertname: "foo" }).toString(16),
          state: AlertState.Firing,
        },
      ],
    },
  ]);
});

test("multiple nodes", () => {
  const tree = parseRawConfig(`
route:
  group_by: ['alertname']
  receiver: 'web.hook'
  routes:
    - receiver: 'web.hook2'
receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'
  - name: 'web.hook2'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'

`);

  const alert = alerts({ alertname: "foo" }, [], false, 1);
  const [groups, _] = groupAlerts(alert, tree);

  const nodeID = Object.keys(groups)[0];

  expect(Object.keys(groups).length).toEqual(1);
  // We should get one group, pointing to web.hook.
  expect(groups[nodeID]).toEqual([
    {
      nodeID,
      labelNames: ["alertname"],
      labelValues: ["foo"],
      receiver: "web.hook",
      alerts: [
        {
          fingerprint: fingerprint({ alertname: "foo" }).toString(16),
          state: AlertState.Firing,
        },
      ],
    },
  ]);
});

test("multiple nodes with continue", () => {
  const tree = parseRawConfig(`
route:
  group_by: ['alertname']
  receiver: 'web.hook'
  continue: true
  routes:
    - receiver: 'web.hook2'
receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'
  - name: 'web.hook2'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'

`);

  const alert = alerts({ alertname: "foo" }, [], false, 1);
  const [groups, _] = groupAlerts(alert, tree);

  const nodeID = Object.keys(groups)[0];
  const nodeID2 = Object.keys(groups)[1];

  expect(Object.keys(groups).length).toEqual(2);
  // We should get two groups, one pointing to web.hook and one pointin to web.hook2.
  expect(groups[nodeID]).toEqual([
    {
      nodeID,
      labelNames: ["alertname"],
      labelValues: ["foo"],
      receiver: "web.hook",
      alerts: [
        {
          fingerprint: fingerprint({ alertname: "foo" }).toString(16),
          state: AlertState.Firing,
        },
      ],
    },
  ]);

  expect(groups[nodeID2]).toEqual([
    {
      nodeID: nodeID2,
      labelNames: ["alertname"],
      labelValues: ["foo"],
      receiver: "web.hook2",
      alerts: [
        {
          fingerprint: fingerprint({ alertname: "foo" }).toString(16),
          state: AlertState.Firing,
        },
      ],
    },
  ]);
});

test("multiple alerts", () => {
  const tree = parseRawConfig(`
route:
  group_by: ['alertname']
  receiver: 'web.hook'
receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://127.0.0.1:5001/'
`);

  const alert = alerts({ alertname: "foo" }, ["service"], false, 2);
  const [groups, _] = groupAlerts(alert, tree);

  const nodeID = Object.keys(groups)[0];

  expect(Object.keys(groups).length).toEqual(1);
  // We should get one group, pointing to web.hook, with two alerts.
  expect(groups[nodeID]).toEqual([
    {
      nodeID,
      labelNames: ["alertname"],
      labelValues: ["foo"],
      receiver: "web.hook",
      alerts: [
        {
          fingerprint: fingerprint({
            alertname: "foo",
            service: "test0",
          }).toString(16),
          state: AlertState.Firing,
        },
        {
          fingerprint: fingerprint({
            alertname: "foo",
            service: "test1",
          }).toString(16),
          state: AlertState.Firing,
        },
      ],
    },
  ]);
});

test("multiple groups", () => {
  const tree = parseRawConfig(`
    route:
      group_by: ['service']
      receiver: 'web.hook'
    receivers:
      - name: 'web.hook'
        webhook_configs:
          - url: 'http://127.0.0.1:5001/'
    `);

  const alert = alerts({ alertname: "foo" }, ["service"], false, 2);
  const [groups, _] = groupAlerts(alert, tree);

  const nodeID = Object.keys(groups)[0];

  expect(Object.keys(groups).length).toEqual(1);
  // We should get two groups, pointing to web.hook, with two alerts.
  expect(groups[nodeID]).toEqual([
    {
      nodeID,
      labelNames: ["service"],
      labelValues: ["test0"],
      receiver: "web.hook",
      alerts: [
        {
          fingerprint: fingerprint({
            alertname: "foo",
            service: "test0",
          }).toString(16),
          state: AlertState.Firing,
        },
      ],
    },
    {
      nodeID,
      labelNames: ["service"],
      labelValues: ["test1"],
      receiver: "web.hook",
      alerts: [
        {
          fingerprint: fingerprint({
            alertname: "foo",
            service: "test1",
          }).toString(16),
          state: AlertState.Firing,
        },
      ],
    },
  ]);
});
