package policy

type Config struct {
	Inbound DecisionThresholds `json:"inbound"`
}

type DecisionThresholds struct {
	Reject     float64 `json:"reject"`
	Quarantine float64 `json:"quarantine"`
}
