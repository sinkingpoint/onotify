package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/alecthomas/kong"
)

var CLI struct {
	SendAlerts struct {
		URL            string            `name:"url" default:"http://localhost:9093/api/v2/alerts"`
		Headers        map[string]string `name:"headers" optional:""`
		Num            int               `name:"num" default:"1" help:"the number of alerts to send"`
		StaticLabels   map[string]string `name:"static-labels" optional:"" help:"the static labels to set in the alert"`
		VaryLabelNames []string          `name:"vary-labels" optional:"" help:"the label names to vary the values of"`
		Status         string            `name:"status" enum:"firing,resolved" help:"the status of the alerts" default:"firing"`
		Annotations    map[string]string `name:"annotations" help:"the annotations to add to the alert"`
	} `cmd:"send-alert" help:"Send test alerts"`
}

type Alert struct {
	StartsAt    string            `json:"startsAt,omitempty"`
	EndsAt      string            `json:"endsAt,omitempty"`
	Annotations map[string]string `json:"annotations"`
	Labels      map[string]string `json:"labels"`
}

func sendAlerts() error {
	if CLI.SendAlerts.Annotations == nil {
		CLI.SendAlerts.Annotations = map[string]string{}
	}

	url, err := url.Parse(CLI.SendAlerts.URL)
	if err != nil {
		return fmt.Errorf("failed to parse URL: %w", err)
	}

	payload := []Alert{}
	for i := 0; i < CLI.SendAlerts.Num; i++ {
		var startsAt, endsAt string
		if CLI.SendAlerts.Status == "firing" {
			startsAt = time.Now().Format(time.RFC3339)
		} else if CLI.SendAlerts.Status == "resolved" {
			startsAt = time.Now().Add(-5 * time.Second).Format(time.RFC3339)
			endsAt = time.Now().Format(time.RFC3339)
		}

		labels := map[string]string{}
		for k, v := range CLI.SendAlerts.StaticLabels {
			labels[k] = v
		}

		for _, k := range CLI.SendAlerts.VaryLabelNames {
			labels[k] = fmt.Sprintf("label-%d", i)
		}

		payload = append(payload, Alert{
			StartsAt:    startsAt,
			EndsAt:      endsAt,
			Labels:      labels,
			Annotations: CLI.SendAlerts.Annotations,
		})
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to encode alert payload: %w", err)
	}

	fmt.Println(string(body))

	client := http.Client{
		Timeout: 5 * time.Second,
	}

	headers := map[string][]string{
		"Content-Type": {"application/json"},
	}

	for k, v := range CLI.SendAlerts.Headers {
		headers[k] = []string{v}
	}

	req := &http.Request{
		Method: http.MethodPost,
		URL:    url,
		Header: headers,
		Body:   io.NopCloser(bytes.NewBuffer(body)),
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send alerts: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bad response code: %d (%s)", resp.StatusCode, string(body))
	}

	return nil
}

func main() {
	ctx := kong.Parse(&CLI)
	switch ctx.Command() {
	case "send-alerts":
		if err := sendAlerts(); err != nil {
			fmt.Printf("failed to send alerts: %s", err)
		}
	default:
		panic(fmt.Sprintf("BUG: unhandled command: %s", ctx.Command()))
	}
}
