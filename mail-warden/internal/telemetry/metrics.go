package telemetry

type Snapshot struct {
	MessagesReceived    int64 `json:"messages_received"`
	MessagesAccepted    int64 `json:"messages_accepted"`
	MessagesRejected    int64 `json:"messages_rejected"`
	MessagesQuarantined int64 `json:"messages_quarantined"`
	SMTPConnections     int64 `json:"smtp_connections"`
	InvalidRecipients   int64 `json:"invalid_recipients"`
}
