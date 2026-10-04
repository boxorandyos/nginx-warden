package scoring

import "math"

type EngineConfig struct {
	RejectThreshold     float64
	QuarantineThreshold float64
}

func DefaultEngineConfig() EngineConfig {
	return EngineConfig{
		RejectThreshold:     -30,
		QuarantineThreshold: -10,
	}
}

type Engine struct {
	cfg EngineConfig
}

func NewEngine(cfg EngineConfig) *Engine {
	return &Engine{cfg: cfg}
}

func (e *Engine) Evaluate(n NormalizedDecisionObject) Decision {
	hardSignals := collectHardSignals(n)
	if len(hardSignals) > 0 {
		return Decision{
			Action:      hardSignalAction(hardSignals),
			Reason:      "hard security gate triggered",
			HardSignals: hardSignals,
		}
	}

	signals := buildSignals(n)

	var trust, risk float64
	for _, s := range signals {
		v := s.Bounded()
		if v >= 0 {
			trust += v
		} else {
			risk += math.Abs(v)
		}
	}

	score := trust - risk
	return Decision{
		Action:      e.actionFromScore(score),
		Score:       score,
		TrustScore:  trust,
		RiskScore:   risk,
		Reason:      "score-based policy",
		Signals:     signals,
		HardSignals: nil,
	}
}

func (e *Engine) actionFromScore(score float64) Action {
	switch {
	case score <= e.cfg.RejectThreshold:
		return ActionReject
	case score <= e.cfg.QuarantineThreshold:
		return ActionQuarantine
	default:
		return ActionAccept
	}
}

func collectHardSignals(n NormalizedDecisionObject) []HardSignal {
	var out []HardSignal
	if n.Content.MalwareConfirmed {
		out = append(out, HardMalwareConfirmed)
	}
	if n.Content.MaliciousURL && n.Content.MaliciousURLConfidence == "critical" {
		out = append(out, HardMaliciousURLCritical)
	}
	if n.Behavior.EnumerationLikely && n.Envelope.InvalidRatio >= 0.8 {
		out = append(out, HardProtocolAbuse)
	}
	return out
}

func hardSignalAction(hardSignals []HardSignal) Action {
	for _, h := range hardSignals {
		if h == HardMalwareConfirmed {
			return ActionReject
		}
	}
	return ActionQuarantine
}

func buildSignals(n NormalizedDecisionObject) []Signal {
	return []Signal{
		{
			Name:  "sender_reputation",
			Value: n.Identity.SenderReputation,
			Min:   -10,
			Max:   10,
		},
		{
			Name:  "domain_reputation",
			Value: n.Identity.DomainReputation,
			Min:   -10,
			Max:   10,
		},
		{
			Name:  "known_correspondent",
			Value: correspondentScore(n.Relationship.KnownCorrespondent, n.Relationship.InteractionCount),
			Min:   -10,
			Max:   10,
		},
		{
			Name:  "invalid_recipient_ratio",
			Value: invalidRecipientPenalty(n.Envelope.InvalidRatio),
			Min:   -15,
			Max:   5,
		},
		{
			Name:  "authentication",
			Value: authScore(n.Authentication),
			Min:   -15,
			Max:   5,
		},
		{
			Name:  "rspamd_score",
			Value: rspamdScoreAdjustment(n.Content.RspamdScore),
			Min:   -20,
			Max:   5,
		},
		{
			Name:  "malicious_url",
			Value: maliciousURLPenalty(n.Content.MaliciousURL),
			Min:   -30,
			Max:   0,
		},
	}
}

func correspondentScore(known bool, interactions int) float64 {
	if !known {
		return 0
	}
	switch {
	case interactions >= 100:
		return 10
	case interactions >= 50:
		return 9
	case interactions >= 25:
		return 8
	case interactions >= 10:
		return 6
	case interactions >= 5:
		return 4
	default:
		return 1
	}
}

func invalidRecipientPenalty(ratio float64) float64 {
	switch {
	case ratio >= 0.8:
		return -10
	case ratio >= 0.6:
		return -9
	case ratio >= 0.3:
		return -7
	case ratio >= 0.1:
		return -3
	case ratio > 0:
		return -1
	default:
		return 0
	}
}

func authScore(a AuthenticationFacts) float64 {
	score := 0.0
	if a.SPF == "fail" {
		score -= 3
	} else if a.SPF == "pass" {
		score += 1
	}
	if a.DKIM == "fail" {
		score -= 3
	} else if a.DKIM == "pass" {
		score += 1
	}
	if a.DMARC == "fail" {
		score -= 4
	} else if a.DMARC == "pass" {
		score += 2
	}
	return score
}

func rspamdScoreAdjustment(score float64) float64 {
	switch {
	case score >= 15:
		return -20
	case score >= 10:
		return -15
	case score >= 5:
		return -8
	case score >= 2:
		return -3
	case score < 0:
		return 2
	default:
		return 0
	}
}

func maliciousURLPenalty(detected bool) float64 {
	if detected {
		return -10
	}
	return 0
}
